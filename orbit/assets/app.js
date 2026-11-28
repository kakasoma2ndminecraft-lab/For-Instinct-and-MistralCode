(function () {
  "use strict";

  var API_BASE = "https://api.mistral.ai";
  var API_URL = API_BASE + "/v1/chat/completions";
  var MODEL = "mistral-small-latest";
  var KEY_STORAGE = "orbit_mistral_api_key";

  var el = {
    goalInput: document.getElementById("goalInput"),
    runButton: document.getElementById("runButton"),
    runState: document.getElementById("runState"),
    goalHint: document.getElementById("goalHint"),
    errorArea: document.getElementById("errorArea"),
    agentList: document.getElementById("agentList"),
    agentCount: document.getElementById("agentCount"),
    timeline: document.getElementById("timeline"),
    demoBadge: document.getElementById("demoBadge"),
    apiChip: document.getElementById("apiChip"),
    openSettings: document.getElementById("openSettings"),
    settingsModal: document.getElementById("settingsModal"),
    apiKeyInput: document.getElementById("apiKeyInput"),
    keyStatus: document.getElementById("keyStatus"),
    saveKey: document.getElementById("saveKey"),
    clearKey: document.getElementById("clearKey")
  };

  var state = {
    running: false,
    apiKey: "",
    agents: [],
    deliverableText: "",
    goal: "",
    approved: false
  };

  var ROLE_NAMES = {
    "プランナー": "ミオ",
    "企画": "ミオ",
    "リサーチャー": "ソラ",
    "リサーチ": "ソラ",
    "調査": "ソラ",
    "ライター": "ユイ",
    "執筆": "ユイ",
    "文章": "ユイ",
    "レビュアー": "レイ",
    "レビュー": "レイ",
    "校正": "レイ",
    "デザイナー": "コト",
    "デザイン": "コト",
    "エンジニア": "カイ",
    "実装": "カイ",
    "まとめ": "ノア",
    "まとめ役": "ノア",
    "編集長": "ノア",
    "ファシリテーター": "ノア"
  };

  function getStoredKey() {
    try {
      return window.localStorage.getItem(KEY_STORAGE) || "";
    } catch (e) {
      return "";
    }
  }

  function storeKey(key) {
    try {
      if (key) {
        window.localStorage.setItem(KEY_STORAGE, key);
      } else {
        window.localStorage.removeItem(KEY_STORAGE);
      }
    } catch (e) {
      /* localStorage unavailable: session-only key */
    }
  }

  function isDemo() {
    return !state.apiKey;
  }

  function updateModeIndicators() {
    var demo = isDemo();
    el.demoBadge.hidden = !demo;
    el.apiChip.hidden = demo;
    el.goalHint.textContent = demo
      ? "デモモード: キーを設定しなくても、チームの一連の流れを体験できます。"
      : "API接続: 実際のAIチームが目標を分解し、順番に作業します。";
  }

  function showError(title, detail) {
    el.errorArea.innerHTML = "";
    var banner = document.createElement("div");
    banner.className = "error-banner";

    var icon = document.createElement("span");
    icon.textContent = "!";
    icon.setAttribute("aria-hidden", "true");
    icon.style.fontWeight = "800";

    var text = document.createElement("div");
    var t = document.createElement("span");
    t.className = "error-banner-title";
    t.textContent = title;
    text.appendChild(t);
    if (detail) {
      var d = document.createElement("span");
      d.className = "error-banner-detail";
      d.textContent = detail;
      text.appendChild(d);
    }

    var close = document.createElement("button");
    close.className = "error-close";
    close.type = "button";
    close.setAttribute("aria-label", "閉じる");
    close.textContent = "×";
    close.addEventListener("click", function () {
      banner.remove();
    });

    banner.appendChild(icon);
    banner.appendChild(text);
    banner.appendChild(close);
    el.errorArea.appendChild(banner);
    banner.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function clearError() {
    el.errorArea.innerHTML = "";
  }

  function mapHttpError(status) {
    switch (status) {
      case 401:
      case 403:
        return { title: "APIキーが無効です。設定を確認してください", detail: "「APIキー設定」から正しいキーを保存し直すか、キーを削除してデモモードをお試しください。" };
      case 402:
        return { title: "Mistralのクレジット不足です", detail: "Mistralコンソールでクレジットを追加するか、デモモードをお試しください。" };
      case 429:
        return { title: "リクエスト制限中です。少し待ってから再試行してください", detail: "しばらく待ってからもう一度お試しください。" };
      case 500:
      case 502:
      case 503:
        return { title: "Mistralのサーバーでエラーが発生しました", detail: "しばらく待ってから再試行してください。" };
      default:
        return { title: "APIリクエストに失敗しました (HTTP " + status + ")", detail: "設定を確認するか、しばらく待ってから再試行してください。" };
    }
  }

  function initialOf(name) {
    return name ? name.charAt(0) : "?";
  }

  function agentNameForRole(role) {
    var clean = (role || "").replace(/\s+/g, "");
    if (ROLE_NAMES[clean]) {
      return ROLE_NAMES[clean];
    }
    for (var key in ROLE_NAMES) {
      if (clean.indexOf(key) !== -1) {
        return ROLE_NAMES[key];
      }
    }
    return clean ? clean : "エージェント";
  }

  function renderAgents() {
    el.agentList.innerHTML = "";
    el.agentCount.textContent = state.agents.length + "人";
    state.agents.forEach(function (agent) {
      var card = document.createElement("div");
      card.className = "agent-card" + (agent.status === "作業中" ? " is-working" : agent.status === "完了" ? " is-done" : "");
      card.id = "agent-" + agent.id;

      var avatar = document.createElement("div");
      avatar.className = "avatar" + (agent.status === "作業中" ? " is-active" : "");
      avatar.textContent = initialOf(agent.name);

      var main = document.createElement("div");
      main.className = "agent-main";
      var name = document.createElement("div");
      name.className = "agent-name";
      name.textContent = agent.name;
      var role = document.createElement("div");
      role.className = "agent-role";
      role.textContent = agent.role;
      main.appendChild(name);
      main.appendChild(role);

      var status = document.createElement("span");
      status.className = "agent-status" + (agent.status === "作業中" ? " is-working" : agent.status === "完了" ? " is-done" : "");
      status.textContent = agent.status;

      card.appendChild(avatar);
      card.appendChild(main);
      card.appendChild(status);
      el.agentList.appendChild(card);
    });
  }

  function setAgentStatus(agentId, status) {
    var agent = state.agents.find(function (a) { return a.id === agentId; });
    if (agent) {
      agent.status = status;
      renderAgents();
    }
  }

  function clearTimeline() {
    el.timeline.innerHTML = "";
  }

  function addSystemMessage(text) {
    var msg = document.createElement("div");
    msg.className = "msg is-system";
    var bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;
    msg.appendChild(bubble);
    el.timeline.appendChild(msg);
    scrollTimeline();
    return bubble;
  }

  function addUserMessage(text) {
    var msg = document.createElement("div");
    msg.className = "msg is-user";

    var avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "あ";

    var body = document.createElement("div");
    body.className = "msg-body";
    var name = document.createElement("div");
    name.className = "msg-name";
    name.textContent = "あなた";
    var bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;
    body.appendChild(name);
    body.appendChild(bubble);

    msg.appendChild(avatar);
    msg.appendChild(body);
    el.timeline.appendChild(msg);
    scrollTimeline();
    return bubble;
  }

  function addAgentMessage(agent) {
    var msg = document.createElement("div");
    msg.className = "msg";

    var avatar = document.createElement("div");
    avatar.className = "avatar is-active";
    avatar.id = "avatar-" + agent.id;
    avatar.textContent = initialOf(agent.name);

    var body = document.createElement("div");
    body.className = "msg-body";
    var name = document.createElement("div");
    name.className = "msg-name";
    name.textContent = agent.name;
    var roleSpan = document.createElement("span");
    roleSpan.textContent = agent.role;
    name.appendChild(roleSpan);
    var bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = "";
    body.appendChild(name);
    body.appendChild(bubble);

    msg.appendChild(avatar);
    msg.appendChild(body);
    el.timeline.appendChild(msg);
    scrollTimeline();
    return bubble;
  }

  function addTypingIndicator(agent) {
    var bubble = addAgentMessage(agent);
    bubble.innerHTML = "";
    var typing = document.createElement("span");
    typing.className = "typing";
    typing.appendChild(document.createElement("i"));
    typing.appendChild(document.createElement("i"));
    typing.appendChild(document.createElement("i"));
    bubble.appendChild(typing);
    scrollTimeline();
    return bubble;
  }

  function scrollTimeline() {
    el.timeline.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function setRunning(running) {
    state.running = running;
    el.runButton.disabled = running;
    el.runButton.textContent = running ? "チームが作業中…" : "チームを動かす";
    el.runState.textContent = running ? "実行中" : "";
    el.goalInput.disabled = running;
  }

  function resetWorkspace() {
    clearError();
    clearTimeline();
    state.agents = [];
    state.deliverableText = "";
    state.approved = false;
    renderAgents();
  }

  function extractJsonArray(text) {
    var start = text.indexOf("[");
    var end = text.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (e) {
      return null;
    }
  }

  function fallbackTasks(goal) {
    return [
      { role: "プランナー", title: "全体の企画と進め方をまとめる" },
      { role: "リサーチャー", title: "必要な情報を調査して整理する" },
      { role: "ライター", title: "成果物の本文ドラフトを書く" },
      { role: "レビュアー", title: "内容をチェックして改善点を指摘する" }
    ];
  }

  async function callMistral(messages, useStream, onDelta) {
    var response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + state.apiKey
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        stream: !!useStream
      })
    });

    if (!response.ok) {
      var mapped = mapHttpError(response.status);
      var err = new Error(mapped.title);
      err.handled = true;
      err.detail = mapped.detail;
      throw err;
    }

    if (!useStream) {
      var data = await response.json();
      return data.choices[0].message.content;
    }

    var reader = response.body.getReader();
    var decoder = new TextDecoder("utf-8");
    var buffer = "";
    var full = "";

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      var lines = buffer.split("\n");
      buffer = lines.pop();
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || line.charAt(0) === ":") {
          continue;
        }
        if (line.indexOf("data:") !== 0) {
          continue;
        }
        var payload = line.slice(5).trim();
        if (payload === "[DONE]") {
          continue;
        }
        try {
          var json = JSON.parse(payload);
          var delta = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
          if (delta) {
            full += delta;
            if (onDelta) {
              onDelta(full);
            }
          }
        } catch (e) {
          /* ignore malformed keep-alive chunks */
        }
      }
    }
    return full;
  }

  function typeInto(bubble, text, speed) {
    return new Promise(function (resolve) {
      bubble.textContent = "";
      var index = 0;
      var timer = setInterval(function () {
        index = Math.min(text.length, index + 2);
        bubble.textContent = text.slice(0, index);
        scrollTimeline();
        if (index >= text.length) {
          clearInterval(timer);
          resolve();
        }
      }, speed);
    });
  }

  var DEMO_SCRIPT = {
    "プランナー": function (goal) {
      return "企画書「" + goal + "」の全体構成をまとめました。\n\n1. ターゲットと目的の整理\n2. 実施期間と条件の設定\n3. キャンペーン施策3案(来店特典 / SNS投稿企画 / コラボ企画)\n4. 効果測定の指標(KPI)\n\n次の担当者に、この構成をもとにした調査と執筆をお願いします。";
    },
    "リサーチャー": function (goal) {
      return "「" + goal + "」に必要な情報を調査し、整理しました。\n\n- 類似の取り組みでは、来店特典とSNS連動企画の組み合わせが効果的という傾向\n- 開催期間は2〜3週間が無理が出にくく、効果測定もしやすい\n- 認知獲得には開始前のティザー告知が重要\n\nこの前提をもとに、文案づくりを進めてください。";
    },
    "ライター": function (goal) {
      return "「" + goal + "」の告知文ドラフトを作成しました。\n\nキャッチコピー:\n「はじめの一杯を、特別に。」\n\n告知文(短縮版):\nオープンを記念して、先着でドリンク1杯をプレゼント。期間限定のスペシャルメニューも登場します。詳しくは店頭および公式アカウントで。\n\n告知文(詳細版):\nオープン初日から3週間、来店特典・SNS投稿企画・コラボメニューの3本立てで実施します。投稿ハッシュタグは #はじめの一杯 を使用します。";
    },
    "レビュアー": function (goal) {
      return "全体のレビューが完了しました。\n\n- 構成: 目的→施策→測定の順で一貫しており、問題なし\n- 文案: 対象読者に響くトーンで、法的・表現上の問題もなし\n- 改善点: KPIに「リピート来店率」を加えると、施策後の振り返りがしやすくなります\n\n上記1点を修正のうえ、まとめ役へ引き継ぎます。";
    }
  };

  var DEMO_DELIVERABLE = function (goal) {
    return "# 「" + goal + "」実行プラン\n\n## 1. 目的とターゲット\n- 目的: オープン時期の集客と認知の定着\n- ターゲット: 近隣在住の20〜40代、SNSで店舗情報を収集する層\n\n## 2. 実施期間\n- 期間: オープン初日から3週間\n- 前段: 開始1週間前にティザー告知を開始\n\n## 3. 施策\n1. 来店特典: 先着でドリンク1杯プレゼント(キャッチコピー「はじめの一杯を、特別に。」)\n2. SNS投稿企画: ハッシュタグ #はじめの一杯 の投稿でデザートを1点進呈\n3. コラボ企画: 近隣店舗との限定コラボメニューを週替わりで投入\n\n## 4. 効果測定(KPI)\n- 来店者数(前週比)\n- ハッシュタグ投稿数\n- リピート来店率\n\n## 5. ふりかえり\n- 期間終了後にKPIを振り返り、次の常設施策につなげる";
  };

  function demoAgentsFor(goal) {
    var roles = ["プランナー", "リサーチャー", "ライター", "レビュアー"];
    return roles.map(function (role, index) {
      return {
        id: "a" + index,
        role: role,
        title: role + "として「" + goal + "」に取り組む",
        name: agentNameForRole(role)
      };
    });
  }

  function addDeliverableCard(text, agent) {
    var card = document.createElement("div");
    card.className = "deliverable";
    card.id = "deliverableCard";

    var head = document.createElement("div");
    head.className = "deliverable-head";
    var label = document.createElement("span");
    label.className = "deliverable-label";
    label.textContent = "成果物";
    head.appendChild(label);
    var by = document.createElement("span");
    by.className = "panel-count";
    by.textContent = "まとめ役 · " + agent.name;
    head.appendChild(by);

    var title = document.createElement("div");
    title.className = "deliverable-title";
    title.textContent = "「" + state.goal + "」のまとめ";

    var content = document.createElement("div");
    content.className = "deliverable-content";
    content.textContent = "";

    var actions = document.createElement("div");
    actions.className = "deliverable-actions";

    var approve = document.createElement("button");
    approve.className = "btn btn-primary btn-sm";
    approve.type = "button";
    approve.textContent = "承認する";
    approve.addEventListener("click", function () {
      state.approved = true;
      card.classList.add("is-approved");
      approve.remove();
      var tag = document.createElement("span");
      tag.className = "approved-tag";
      tag.textContent = "✓ 承認済み — おつかさまでした!";
      actions.insertBefore(tag, actions.firstChild);
    });

    var download = document.createElement("button");
    download.className = "btn btn-ghost btn-sm";
    download.type = "button";
    download.textContent = "Markdownをダウンロード";
    download.addEventListener("click", function () {
      downloadMarkdown(text);
    });

    actions.appendChild(approve);
    actions.appendChild(download);

    card.appendChild(head);
    card.appendChild(title);
    card.appendChild(content);
    card.appendChild(actions);
    el.timeline.appendChild(card);

    scrollTimeline();
    return content;
  }

  function downloadMarkdown(text) {
    var now = new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + "-" + pad(now.getHours()) + pad(now.getMinutes());
    var lines = [];
    lines.push("# ORBIT 成果物");
    lines.push("");
    lines.push("- 目標: " + state.goal);
    lines.push("- 生成日時: " + now.toLocaleString("ja-JP"));
    lines.push("- モード: " + (isDemo() ? "デモモード" : "Mistral API (" + MODEL + ")"));
    lines.push("- 承認: " + (state.approved ? "承認済み" : "未承認"));
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(text);

    var blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "orbit-deliverable-" + stamp + ".md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  async function runDemo(goal) {
    var agents = demoAgentsFor(goal);
    state.agents = agents;
    renderAgents();
    addSystemMessage("デモモード: スクリプト化された応答でチームの動きを再現しています。");

    await sleep(400);

    var outputs = [];
    for (var i = 0; i < agents.length; i++) {
      var agent = agents[i];
      setAgentStatus(agent.id, "作業中");
      var bubble = addTypingIndicator(agent);
      await sleep(500);
      var text = DEMO_SCRIPT[agent.role]
        ? DEMO_SCRIPT[agent.role](goal)
        : "「" + goal + "」の担当タスク「" + agent.title + "」を完了しました。";
      await typeInto(bubble, text, 14);
      outputs.push({ role: agent.role, name: agent.name, text: text });
      setAgentStatus(agent.id, "完了");
      await sleep(350);
    }

    var summarizer = {
      id: "summary",
      role: "まとめ役",
      name: "ノア"
    };
    state.agents.push(summarizer);
    renderAgents();
    setAgentStatus("summary", "作業中");
    addSystemMessage("まとめ役の" + summarizer.name + "が、全体を統合して成果物を作成します…");
    await sleep(600);

    var deliverableText = DEMO_DELIVERABLE(goal);
    state.deliverableText = deliverableText;
    var contentEl = addDeliverableCard("", summarizer);
    await typeInto(contentEl, deliverableText, 6);
    setAgentStatus("summary", "完了");
    setRunning(false);
  }

  async function runApi(goal) {
    var decomposeMessages = [
      {
        role: "system",
        content: "あなたはワークスペースのオーケストレーターです。ユーザーの目標を、実行可能なタスクに分解してください。出力は必ず次のJSON形式のみ(説明文は不要): [{\"role\":\"役割名(日本語3〜6文字)\",\"title\":\"この役割が担う具体的なタスク(日本語)\"}] タスクは3〜4個。最後の統合はシステムが行うため、まとめ役は含めないでください。"
      },
      {
        role: "user",
        content: "目標: " + goal
      }
    ];

    var raw;
    try {
      raw = await callMistral(decomposeMessages, false, null);
    } catch (e) {
      if (e.handled) {
        throw e;
      }
      var netErr = new Error("ネットワークエラーでAPIに接続できませんでした");
      netErr.handled = true;
      throw netErr;
    }

    var parsed = extractJsonArray(raw);
    var tasks = Array.isArray(parsed) && parsed.length
      ? parsed.filter(function (t) { return t && t.role && t.title; }).slice(0, 4)
      : fallbackTasks(goal);

    if (!tasks.length) {
      tasks = fallbackTasks(goal);
    }

    var agents = tasks.map(function (task, index) {
      return {
        id: "a" + index,
        role: String(task.role),
        title: String(task.title),
        name: agentNameForRole(String(task.role))
      };
    });
    state.agents = agents;
    renderAgents();
    addSystemMessage("目標を " + agents.length + " つのタスクに分解しました。チームメイトが順番に作業をはじめます。");

    var context = [];
    for (var i = 0; i < agents.length; i++) {
      var agent = agents[i];
      setAgentStatus(agent.id, "作業中");
      var bubble = addTypingIndicator(agent);

      var historyText = context.length
        ? context.map(function (c) { return "【" + c.role + "(" + c.name + ")の出力】\n" + c.text; }).join("\n\n")
        : "(まだ完了したタスクはありません。あなたが最初の担当です。)";

      var messages = [
        {
          role: "system",
          content: "あなたは「" + agent.name + "」。ORBITワークスペースのAIチームメイトで、役割は「" + agent.role + "」です。自分の役割に徹し、チームメイトが読みやすい日本語で、具体的で実用的なアウトプットを返してください。"
        },
        {
          role: "user",
          content: "チームの目標: " + goal + "\n\nあなたの担当タスク: " + agent.title + "\n\nこれまでのチームメイトの出力:\n" + historyText + "\n\n上記を踏まえて、あなたの担当タスクを実行してください。"
        }
      ];

      var text = "";
      try {
        text = await callMistral(messages, true, function (full) {
          bubble.textContent = full;
        });
      } catch (e) {
        setAgentStatus(agent.id, "待機");
        throw e;
      }

      bubble.textContent = text || "(応答なし)";
      if (!text) {
        var emptyErr = new Error("APIから空の応答が返りました。もう一度お試しください");
        emptyErr.handled = true;
        throw emptyErr;
      }
      context.push({ role: agent.role, name: agent.name, text: text });
      setAgentStatus(agent.id, "完了");
    }

    var summarizer = { id: "summary", role: "まとめ役", name: "ノア" };
    state.agents.push(summarizer);
    renderAgents();
    setAgentStatus("summary", "作業中");
    addSystemMessage("まとめ役の" + summarizer.name + "が、全体を統合して成果物を作成します…");

    var summaryMessages = [
      {
        role: "system",
        content: "あなたは「ノア」。ORBITワークスペースのまとめ役です。チームメイトの出力を統合し、重複を除いて、Markdown形式の完成した成果物として1つに仕上げてください。見出し・箇条書きを使い、すぐ使える形にしてください。"
      },
      {
        role: "user",
        content: "チームの目標: " + goal + "\n\nチームメイトの出力:\n" + context.map(function (c) { return "【" + c.role + "(" + c.name + ")】\n" + c.text; }).join("\n\n") + "\n\nこれらを統合した成果物をMarkdownで出力してください。"
      }
    ];

    var deliverableText = "";
    var contentEl = addDeliverableCard("", summarizer);
    try {
      deliverableText = await callMistral(summaryMessages, true, function (full) {
        contentEl.textContent = full;
      });
    } catch (e) {
      setAgentStatus("summary", "待機");
      throw e;
    }

    if (!deliverableText) {
      var emptyErr2 = new Error("APIから空の応答が返りました。もう一度お試しください");
      emptyErr2.handled = true;
      throw emptyErr2;
    }

    state.deliverableText = deliverableText;
    contentEl.textContent = deliverableText;
    setAgentStatus("summary", "完了");
    setRunning(false);
  }

  async function run() {
    if (state.running) {
      return;
    }
    var goal = el.goalInput.value.trim();
    if (!goal) {
      showError("目標を入力してください", "例: 新規カフェのオープンキャンペーンを企画して");
      el.goalInput.focus();
      return;
    }

    clearError();
    resetWorkspace();
    state.goal = goal;
    setRunning(true);
    addUserMessage(goal);

    try {
      if (isDemo()) {
        await runDemo(goal);
      } else {
        await runApi(goal);
      }
      el.runState.textContent = "完了";
    } catch (e) {
      setRunning(false);
      el.runState.textContent = "";
      if (e.handled) {
        showError(e.message, e.detail);
      } else {
        showError("予期しないエラーが発生しました", e && e.message ? e.message : String(e));
      }
    }
  }

  function openModal() {
    el.apiKeyInput.value = state.apiKey || "";
    el.keyStatus.textContent = state.apiKey
      ? "キーが保存されています。変更したい場合は新しいキーを入力してください。"
      : "キーが未設定のため、デモモードで動作します。";
    el.settingsModal.classList.add("is-open");
    el.apiKeyInput.focus();
  }

  function closeModal() {
    el.settingsModal.classList.remove("is-open");
  }

  el.runButton.addEventListener("click", run);

  el.goalInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      run();
    }
  });

  el.openSettings.addEventListener("click", openModal);

  el.settingsModal.addEventListener("click", function (e) {
    if (e.target === el.settingsModal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeModal();
    }
  });

  el.saveKey.addEventListener("click", function () {
    var key = el.apiKeyInput.value.trim();
    if (key) {
      storeKey(key);
      state.apiKey = key;
      el.keyStatus.textContent = "キーを保存しました。次回の実行から実際のAIチームが動きます。";
      setTimeout(function () {
        closeModal();
        updateModeIndicators();
      }, 700);
    } else {
      storeKey("");
      state.apiKey = "";
      updateModeIndicators();
      closeModal();
    }
  });

  el.clearKey.addEventListener("click", function () {
    storeKey("");
    state.apiKey = "";
    el.apiKeyInput.value = "";
    el.keyStatus.textContent = "キーを削除しました。デモモードで動作します。";
    updateModeIndicators();
  });

  state.apiKey = getStoredKey();
  updateModeIndicators();
})();
