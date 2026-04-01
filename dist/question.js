// src/question/index.ts
import {
  keyHint,
  rawKeyHint
} from "@mariozechner/pi-coding-agent";
import { Editor, Text, truncateToWidth } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
var questionOptionSchema = Type.Object({
  label: Type.String({
    description: "Display text (1-5 words, concise). Do not use generic fallback labels like Other or Custom answer."
  }),
  description: Type.String({ description: "Explanation of choice" })
});
var questionInfoSchema = Type.Object({
  question: Type.String({ description: "Complete question" }),
  header: Type.String({ description: "Very short label (max 30 chars)" }),
  options: Type.Array(questionOptionSchema, {
    minItems: 1,
    description: "Available choices. Do not include generic fallback choices like Other or any custom-answer placeholder. The UI adds a built-in custom-answer option automatically."
  }),
  multiple: Type.Optional(
    Type.Boolean({
      description: "Allow selecting multiple choices. Set this to true whenever more than one option may reasonably apply."
    })
  )
});
var questionToolSchema = Type.Object({
  questions: Type.Array(questionInfoSchema, {
    minItems: 1,
    description: "Questions to ask"
  })
});
var CUSTOM_OPTION_LABEL = "Type your own answer";
var CUSTOM_OPTION_DESCRIPTION = "Open an input box to type your own answer";
var CUSTOM_PLACEHOLDER = "Type your own answer...";
function normalizeCustomOptionLabel(label) {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}
function isRedundantCustomOptionLabel(label) {
  const normalized = normalizeCustomOptionLabel(label);
  return normalized === "other" || normalized === "custom answer" || normalized === normalizeCustomOptionLabel(CUSTOM_OPTION_LABEL);
}
function normalizeQuestions(input) {
  return input.questions.map((question2, index) => {
    const normalizedQuestion = question2.question.trim();
    const normalizedHeader = question2.header.trim() || `Q${index + 1}`;
    const normalizedOptions = question2.options.map((option) => ({
      label: option.label.trim(),
      description: option.description.trim()
    })).filter((option) => option.label.length > 0).filter((option) => !isRedundantCustomOptionLabel(option.label));
    if (!normalizedQuestion) {
      throw new Error(`Question ${index + 1} is missing question text.`);
    }
    if (normalizedOptions.length === 0) {
      throw new Error(`Question ${index + 1} must include at least one option.`);
    }
    return {
      question: normalizedQuestion,
      header: normalizedHeader,
      options: normalizedOptions,
      multiple: question2.multiple === true
    };
  });
}
function formatAnswers(answer) {
  if (!answer || answer.length === 0) {
    return "Unanswered";
  }
  return answer.join(", ");
}
function createOutput(questions, answers) {
  const formatted = questions.map((question2, index) => `"${question2.question}"="${formatAnswers(answers[index])}"`).join(", ");
  return `User has answered your questions: ${formatted}. You can now continue with the user's answers in mind.`;
}
function createDetails(questions, answers) {
  return {
    title: `Asked ${questions.length} question(s)`,
    output: createOutput(questions, answers),
    metadata: {
      answers
    }
  };
}
function getVisibleOptions(question2) {
  return [
    ...question2.options,
    {
      label: CUSTOM_OPTION_LABEL,
      description: CUSTOM_OPTION_DESCRIPTION,
      custom: true
    }
  ];
}
function isAnswered(answerState) {
  return answerState.selected.length > 0;
}
function setSingleAnswer(answerState, answer, custom = "") {
  answerState.selected = [answer];
  answerState.custom = custom;
}
function prepareSingleCustomAnswer(answerState) {
  answerState.selected = answerState.custom ? [answerState.custom] : [];
}
function toggleMultiAnswer(answerState, answer) {
  const index = answerState.selected.indexOf(answer);
  if (index >= 0) {
    answerState.selected.splice(index, 1);
    return;
  }
  answerState.selected.push(answer);
}
function replaceCustomAnswer(answerState, value, multiple) {
  if (answerState.custom) {
    answerState.selected = answerState.selected.filter((entry) => entry !== answerState.custom);
  }
  answerState.custom = value;
  if (!value) {
    return;
  }
  if (multiple) {
    answerState.selected.push(value);
    return;
  }
  answerState.selected = [value];
}
function getDigitSelection(keyData) {
  if (!/^[1-9]$/.test(keyData)) {
    return void 0;
  }
  return Number.parseInt(keyData, 10) - 1;
}
function formatQuestionCall(args, theme) {
  const count = args.questions.length;
  const headers = args.questions.map((question2) => question2.header.trim()).filter(Boolean).join(", ");
  let text = `${theme.fg("toolTitle", theme.bold("question "))}${theme.fg("muted", `${count} question${count === 1 ? "" : "s"}`)}`;
  if (headers) {
    text += theme.fg("dim", ` (${headers})`);
  }
  return text;
}
function formatQuestionResult(args, result, theme) {
  const headers = args.questions.map((question2) => question2.header.trim());
  const lines = result.details.metadata.answers.map((answers, index) => {
    const header = headers[index] || `Q${index + 1}`;
    return `${theme.fg("success", "\u2713 ")}${theme.fg("accent", header)}: ${theme.fg("text", formatAnswers(answers))}`;
  });
  return lines.join("\n");
}
function createQuestionOverlay(questions, tui, uiTheme, keybindings, done) {
  const answers = questions.map(() => ({ selected: [], custom: "" }));
  const selectedIndexes = questions.map(() => 0);
  const showConfirmTab = questions.length > 1 || questions.some((question2) => question2.multiple);
  const totalTabs = showConfirmTab ? questions.length + 1 : questions.length;
  const editorTheme = {
    borderColor: (value) => uiTheme.fg("accent", value),
    selectList: {
      selectedPrefix: (value) => uiTheme.fg("accent", value),
      selectedText: (value) => uiTheme.fg("accent", value),
      description: (value) => uiTheme.fg("muted", value),
      scrollInfo: (value) => uiTheme.fg("dim", value),
      noMatch: (value) => uiTheme.fg("warning", value)
    }
  };
  const editor = new Editor(tui, editorTheme);
  let currentTab = 0;
  let editingQuestionIndex;
  let cachedLines;
  const refresh = () => {
    cachedLines = void 0;
    tui.requestRender();
  };
  const closeEditor = () => {
    editingQuestionIndex = void 0;
    editor.setText("");
    refresh();
  };
  const submit = () => {
    done(answers.map((answer) => [...answer.selected]));
  };
  const confirmCurrentQuestion = () => {
    const answerState = answers[currentTab];
    if (!answerState || !isAnswered(answerState)) {
      return;
    }
    moveToNextQuestion(currentTab);
  };
  const moveToNextQuestion = (questionIndex) => {
    if (!showConfirmTab && questions.length === 1) {
      submit();
      return;
    }
    if (questionIndex < questions.length - 1) {
      currentTab = questionIndex + 1;
    } else if (showConfirmTab) {
      currentTab = questions.length;
    }
    refresh();
  };
  const applySelection = (questionIndex, optionIndex) => {
    const question2 = questions[questionIndex];
    const answerState = answers[questionIndex];
    const option = getVisibleOptions(question2)[optionIndex];
    if (!question2 || !answerState || !option) {
      return;
    }
    selectedIndexes[questionIndex] = optionIndex;
    if (option.custom) {
      if (!question2.multiple) {
        prepareSingleCustomAnswer(answerState);
      }
      editingQuestionIndex = questionIndex;
      editor.setText(answerState.custom);
      refresh();
      return;
    }
    if (question2.multiple) {
      toggleMultiAnswer(answerState, option.label);
      refresh();
      return;
    }
    setSingleAnswer(answerState, option.label);
    refresh();
  };
  editor.onSubmit = (value) => {
    if (editingQuestionIndex === void 0) {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      closeEditor();
      return;
    }
    const question2 = questions[editingQuestionIndex];
    const answerState = answers[editingQuestionIndex];
    if (!question2 || !answerState) {
      closeEditor();
      return;
    }
    replaceCustomAnswer(answerState, trimmed, question2.multiple);
    closeEditor();
  };
  return {
    render(width) {
      if (cachedLines) {
        return cachedLines;
      }
      const lines = [];
      const add = (value) => lines.push(truncateToWidth(value, width));
      add(uiTheme.fg("accent", "\u2500".repeat(width)));
      if (showConfirmTab) {
        const tabs = questions.map((question3, index) => {
          const active = index === currentTab;
          const answered = isAnswered(answers[index]);
          const text = ` ${question3.header} `;
          if (active) {
            return uiTheme.bg("selectedBg", uiTheme.fg("text", text));
          }
          return uiTheme.fg(answered ? "success" : "muted", text);
        });
        const confirmText = " Confirm ";
        tabs.push(
          currentTab === questions.length ? uiTheme.bg("selectedBg", uiTheme.fg("text", confirmText)) : uiTheme.fg("accent", confirmText)
        );
        add(tabs.join(" "));
        lines.push("");
      }
      if (showConfirmTab && currentTab === questions.length) {
        add(uiTheme.fg("accent", uiTheme.bold(" Ready to submit")));
        lines.push("");
        questions.forEach((question3, index) => {
          add(
            `${uiTheme.fg("muted", `${question3.header}: `)}${uiTheme.fg("text", formatAnswers(answers[index]?.selected))}`
          );
        });
        lines.push("");
        add(
          `${keyHint("tui.select.confirm", "submit")}  ${keyHint("tui.select.cancel", "dismiss")}  ${keyHint("tui.input.tab", "switch")}`
        );
        add(uiTheme.fg("accent", "\u2500".repeat(width)));
        cachedLines = lines;
        return lines;
      }
      const question2 = questions[currentTab];
      const answerState = answers[currentTab];
      const options = getVisibleOptions(question2);
      const selectedIndex = selectedIndexes[currentTab] ?? 0;
      const questionText = question2.multiple ? `${question2.question} (multi-select)` : question2.question;
      add(uiTheme.fg("accent", uiTheme.bold(` ${question2.header}`)));
      add(uiTheme.fg("text", ` ${questionText}`));
      lines.push("");
      for (let index = 0; index < options.length; index++) {
        const option = options[index];
        const focused = index === selectedIndex;
        const isChecked = option.custom ? answerState.custom.length > 0 : answerState.selected.includes(option.label);
        const marker = question2.multiple ? isChecked ? "[x]" : "[ ]" : isChecked ? "(x)" : "( )";
        const line = `${focused ? uiTheme.fg("accent", ">") : " "} ${marker} ${index + 1}. ${option.label}`;
        add(focused ? uiTheme.fg("accent", line) : uiTheme.fg("text", line));
        add(`     ${uiTheme.fg("muted", option.description)}`);
        if (option.custom && answerState.custom) {
          add(`     ${uiTheme.fg("dim", answerState.custom)}`);
        }
      }
      if (editingQuestionIndex === currentTab) {
        lines.push("");
        add(uiTheme.fg("muted", ` ${CUSTOM_PLACEHOLDER}`));
        for (const line of editor.render(width - 2)) {
          add(` ${line}`);
        }
        lines.push("");
        add(`${keyHint("tui.select.confirm", "submit")}  ${keyHint("tui.select.cancel", "dismiss")}`);
      } else {
        lines.push("");
        const hints = [
          rawKeyHint("space", question2.multiple ? "toggle" : "select"),
          keyHint("tui.select.confirm", showConfirmTab ? "next" : "submit"),
          keyHint("tui.select.cancel", "dismiss")
        ];
        if (showConfirmTab) {
          hints.push(keyHint("tui.input.tab", "switch"));
        }
        add(hints.join("  "));
      }
      add(uiTheme.fg("accent", "\u2500".repeat(width)));
      cachedLines = lines;
      return lines;
    },
    invalidate() {
      cachedLines = void 0;
    },
    handleInput(keyData) {
      if (editingQuestionIndex !== void 0) {
        if (keybindings.matches(keyData, "tui.select.cancel")) {
          closeEditor();
          return;
        }
        editor.handleInput(keyData);
        refresh();
        return;
      }
      if (showConfirmTab && keybindings.matches(keyData, "tui.input.tab")) {
        currentTab = (currentTab + 1) % totalTabs;
        refresh();
        return;
      }
      if (showConfirmTab && keybindings.matches(keyData, "tui.editor.cursorRight")) {
        currentTab = (currentTab + 1) % totalTabs;
        refresh();
        return;
      }
      if (showConfirmTab && keybindings.matches(keyData, "tui.editor.cursorLeft")) {
        currentTab = (currentTab - 1 + totalTabs) % totalTabs;
        refresh();
        return;
      }
      if (showConfirmTab && currentTab === questions.length) {
        if (keybindings.matches(keyData, "tui.select.confirm")) {
          submit();
          return;
        }
        if (keybindings.matches(keyData, "tui.select.cancel")) {
          done(void 0);
        }
        return;
      }
      const options = getVisibleOptions(questions[currentTab]);
      const selectedIndex = selectedIndexes[currentTab] ?? 0;
      if (keybindings.matches(keyData, "tui.select.up")) {
        selectedIndexes[currentTab] = Math.max(0, selectedIndex - 1);
        refresh();
        return;
      }
      if (keybindings.matches(keyData, "tui.select.down")) {
        selectedIndexes[currentTab] = Math.min(options.length - 1, selectedIndex + 1);
        refresh();
        return;
      }
      const digitSelection = getDigitSelection(keyData);
      if (digitSelection !== void 0 && digitSelection < options.length) {
        applySelection(currentTab, digitSelection);
        return;
      }
      if (keyData === " ") {
        applySelection(currentTab, selectedIndex);
        return;
      }
      if (keybindings.matches(keyData, "tui.select.confirm")) {
        confirmCurrentQuestion();
        return;
      }
      if (keybindings.matches(keyData, "tui.select.cancel")) {
        done(void 0);
      }
    }
  };
}
function createQuestionToolDefinition() {
  return {
    name: "question",
    label: "question",
    description: "Ask the user one or more structured questions with predefined options and custom-answer support.",
    promptSnippet: "Ask the user structured questions with options, multi-select support, and custom answers.",
    promptGuidelines: [
      "Use this tool when you need the user to choose from explicit options before continuing.",
      "Set multiple=true whenever more than one answer may reasonably apply.",
      "Do not add generic fallback options like Other or Custom answer; the UI already provides Type your own answer.",
      "Provide concise headers and concise option labels."
    ],
    parameters: questionToolSchema,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) {
        throw new Error("Question tool requires interactive UI support.");
      }
      const questions = normalizeQuestions(params);
      const answers = await ctx.ui.custom(
        (tui, uiTheme, keybindings, done) => createQuestionOverlay(questions, tui, uiTheme, keybindings, done),
        {
          overlay: true,
          overlayOptions: {
            anchor: "bottom-center",
            width: "100%",
            maxHeight: "45%",
            margin: { left: 1, right: 1, bottom: 1 }
          }
        }
      );
      if (!answers) {
        throw new Error("Question dismissed by user.");
      }
      const details = createDetails(questions, answers);
      return {
        content: [{ type: "text", text: details.output }],
        details
      };
    },
    renderCall(args, theme, context) {
      const text = context.lastComponent ?? new Text("", 0, 0);
      text.setText(formatQuestionCall(args, theme));
      return text;
    },
    renderResult(result, _options, theme, context) {
      const text = context.lastComponent ?? new Text("", 0, 0);
      text.setText(formatQuestionResult(context.args, result, theme));
      return text;
    }
  };
}
function question(pi) {
  pi.registerTool(createQuestionToolDefinition());
}
export {
  createQuestionToolDefinition,
  question as default
};
//# sourceMappingURL=question.js.map
