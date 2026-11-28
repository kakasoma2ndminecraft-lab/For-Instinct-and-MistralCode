(function () {
  "use strict";

  var API_BASE = "https://api.mistral.ai";
  var API_URL = API_BASE + "/v1/chat/completions";
  var MODEL = "mistral-small-latest";
  var KEY_STORAGE = "orbit_mistral_api_key";
  var THEME_STORAGE = "orbit_theme";
  var SESSIONS_STORAGE = "orbit_sessions";

  var el = {
    goalInput: document.getElementById("goalInput"),
    runButton: document.getElementById("runButton"),
    menuToggle: document.getElementById("menuToggle"),
    sidebar: document.getElementById("sidebar"),
    sidebarOverlay: document.getElementById("sidebarOverlay"),
    newTeamBtn: document.getElementById("newTeamBtn"),
    sessionList: document.getElementById("sessionList"),
    themeToggle: document.getElementById("themeToggle"),
    themeIcon: document.getElementById("themeIcon"),
    openSettings: document.getElementById("openSettings"),
    settingsModal: document.getElementById("settingsModal"),
    apiKeyInput: document.getElementById("apiKeyInput"),
    keyStatus: document.getElementById("keyStatus"),
    saveKey: document.getElementById("saveKey"),
    clearKey: document.getElementById("clearKey"),
    demoBadge: document.getElementById("demoBadge"),
    apiChip: document.getElementById("apiChip"),
    chatTitle: document.getElementById("chatTitle"),
    emptyState: document.getElementById("emptyState"),
    conversation: document.getElementById("conversation"),
    timeline: document.getElementById("timeline"),
    chatScroll: document.getElementById("chatScroll"),
    composeSlotCenter: document.getElementById("composeSlotCenter"),
    composeSlotDock: document.getElementById("composeSlotDock"),
    errorArea: document.getElementById("errorArea"),
    composerBox: document.getElementById("composerBox")
  };

  var state = {
    running: false,
    stopping: false,
    abort: null,
    apiKey: "",
    goal: "",
    agents: [],
    deliverableText: "",
    approved: false,
    messages: [],
    sessionId: null
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

  var SUMMARIZER = { id: "summary", role: "まとめ役", name: "ノア", title: "全体を統合して成果物にまとめる" };

  var ICON_SEND = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  var ICON_STOP = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>';

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

  function getStoredThemeRaw() {
    try {
      return window.localStorage.getItem(THEME_STORAGE) || "";
    } catch (e) {
      return "";
    }
  }

  function isDemo() {
    return !state.apiKey;
  }

  function updateModeIndicators() {
    var demo = isDemo();
    el.demoBadge.hidden = !demo;
    el.apiChip.hidden = demo;
  }

  function currentTheme() {
    var stored = getStoredThemeRaw();
    if (stored === "dark" || stored === "light") {
      return stored;
    }
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (el.themeIcon) {
      el.themeIcon.textContent = theme === "dark" ? "☀" : "☾";
    }
  }

  el.themeToggle.addEventListener("click", function () {
    var next = currentTheme() === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem(THEME_STORAGE, next);
    } catch (e) {}
    applyTheme(next);
  });

  if (window.matchMedia) {
    var media = window.matchMedia("(prefers-color-scheme: dark)");
    var onSystemChange = function () {
      if (!getStoredThemeRaw()) {
        applyTheme(currentTheme());
      }
    };
    if (media.addEventListener) {
      media.addEventListener("change", onSystemChange);
    } else if (media.addListener) {
      media.addListener(onSystemChange);
    }
  }

  function showError(title, detail) {
    el.errorArea.innerHTML = "";
    var banner = document.createElement("div");
    banner.className = "error-banner";

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

    banner.appendChild(text);
    banner.appendChild(close);
    el.errorArea.appendChild(banner);
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

  function truncate(text, max) {
    if (!text) {
      return "";
    }
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
  }

  function renderPlan(agents) {
    var old = document.getElementById("planCard");
    if (old) {
      old.remove();
    }
    if (!agents.length) {
      return;
    }
    var details = document.createElement("details");
    details.className = "plan-card";
    details.id = "planCard";
    details.open = true;

    var summary = document.createElement("summary");
    var label = document.createElement("span");
    label.textContent = "計画";
    var count = document.createElement("span");
    count.className = "plan-count";
    count.textContent = agents.length + "タスク";
    summary.appendChild(label);
    summary.appendChild(count);

    var rows = document.createElement("div");
    rows.className = "plan-rows";
    agents.forEach(function (agent) {
      var row = document.createElement("div");
      row.className = "plan-row";

      var avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.id = "planAvatar-" + agent.id;
      avatar.textContent = initialOf(agent.name);

      var name = document.createElement("span");
      name.className = "plan-agent";
      name.textContent = agent.name;

      var task = document.createElement("span");
      task.className = "plan-task";
      task.textContent = agent.title;

      var status = document.createElement("span");
      status.className = "plan-status";
      status.id = "planStatus-" + agent.id;
      status.textContent = agent.status || "待機";

      row.appendChild(avatar);
      row.appendChild(name);
      row.appendChild(task);
      row.appendChild(status);
      rows.appendChild(row);
    });

    details.appendChild(summary);
    details.appendChild(rows);
    el.timeline.appendChild(details);
  }

  function setAgentStatus(agentId, status) {
    var agent = state.agents.find(function (a) { return a.id === agentId; });
    if (agent) {
      agent.status = status;
    }
    var statusEl = document.getElementById("planStatus-" + agentId);
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.className = "plan-status" + (status === "作業中" ? " is-working" : status === "完了" ? " is-done" : "");
    }
    var avatarEl = document.getElementById("planAvatar-" + agentId);
    if (avatarEl) {
      avatarEl.className = "avatar" + (status === "作業中" ? " is-working" : "");
    }
  }

  function clearTimeline() {
    el.timeline.innerHTML = "";
  }

  function scrollBottom() {
    el.chatScroll.scrollTop = el.chatScroll.scrollHeight;
  }

  function addSystemMessage(text) {
    var msg = document.createElement("div");
    msg.className = "msg msg-system";
    msg.textContent = text;
    el.timeline.appendChild(msg);
    scrollBottom();
  }

  function addUserMessage(text) {
    var msg = document.createElement("div");
    msg.className = "msg msg-user";
    var bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;
    msg.appendChild(bubble);
    el.timeline.appendChild(msg);
    scrollBottom();
  }

  function addAgentMessage(agent) {
    var msg = document.createElement("div");
    msg.className = "msg msg-agent";

    var avatar = document.createElement("div");
    avatar.className = "avatar is-working";
    avatar.id = "avatar-" + agent.id;
    avatar.textContent = initialOf(agent.name);

    var main = document.createElement("div");
    main.className = "msg-agent-main";
    var name = document.createElement("div");
    name.className = "msg-agent-name";
    name.textContent = agent.name;
    var role = document.createElement("span");
    role.textContent = agent.role;
    name.appendChild(role);
    var body = document.createElement("div");
    body.className = "msg-agent-body";
    main.appendChild(name);
    main.appendChild(body);

    msg.appendChild(avatar);
    msg.appendChild(main);
    el.timeline.appendChild(msg);
    scrollBottom();
    return body;
  }

  function addTypingIndicator(agent) {
    var body = addAgentMessage(agent);
    var typing = document.createElement("span");
    typing.className = "typing";
    typing.appendChild(document.createElement("i"));
    typing.appendChild(document.createElement("i"));
    typing.appendChild(document.createElement("i"));
    body.appendChild(typing);
    scrollBottom();
    return body;
  }

  function setRunning(running) {
    state.running = running;
    el.runButton.innerHTML = running ? ICON_STOP : ICON_SEND;
    el.runButton.setAttribute("aria-label", running ? "停止" : "送信");
    updateSendState();
  }

  function updateSendState() {
    if (state.running) {
      el.runButton.disabled = false;
      return;
    }
    el.runButton.disabled = !el.goalInput.value.trim();
  }

  function addLog(entry) {
    state.messages.push(entry);
  }

  function moveComposer(where) {
    var slot = where === "center" ? el.composeSlotCenter : el.composeSlotDock;
    slot.appendChild(el.composerBox);
  }

  function resetRunState() {
    state.agents = [];
    state.deliverableText = "";
    state.approved = false;
    state.messages = [];
    state.sessionId = null;
  }

  function showEmpty() {
    if (state.running) {
      return;
    }
    clearError();
    resetRunState();
    el.emptyState.hidden = false;
    el.conversation.hidden = true;
    clearTimeline();
    el.chatTitle.textContent = "ORBIT";
    el.goalInput.value = "";
    updateSendState();
    moveComposer("center");
  }

  function showConversation() {
    el.emptyState.hidden = true;
    el.conversation.hidden = false;
    el.chatTitle.textContent = state.goal;
    clearError();
    clearTimeline();
    moveComposer("dock");
  }

  function getSessions() {
    try {
      var raw = window.localStorage.getItem(SESSIONS_STORAGE);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function persistSessions(list) {
    try {
      window.localStorage.setItem(SESSIONS_STORAGE, JSON.stringify(list));
    } catch (e) {
      /* storage unavailable */
    }
  }

  function saveSession() {
    if (!state.goal) {
      return;
    }
    if (!state.sessionId) {
      state.sessionId = Date.now();
    }
    var entry = {
      id: state.sessionId,
      ts: Date.now(),
      goal: state.goal,
      mode: isDemo() ? "デモ" : "API",
      approved: state.approved,
      plan: state.agents.map(function (a) {
        return { id: a.id, role: a.role, name: a.name, title: a.title };
      }),
      messages: state.messages,
      deliverable: state.deliverableText
    };
    var list = getSessions().filter(function (s) {
      return s.id !== state.sessionId;
    });
    list.unshift(entry);
    persistSessions(list.slice(0, 20));
    renderSessions();
  }

  function formatDate(ts) {
    var d = new Date(ts);
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return (d.getMonth() + 1) + "/" + d.getDate() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function renderSessions() {
    var list = getSessions();
    el.sessionList.innerHTML = "";
    if (!list.length) {
      var p = document.createElement("p");
      p.className = "session-empty";
      p.textContent = "まだ履歴がありません。";
      el.sessionList.appendChild(p);
      return;
    }
    list.forEach(function (session) {
      var item = document.createElement("button");
      item.className = "session-item" + (session.id === state.sessionId ? " is-active" : "");
      item.type = "button";

      var title = document.createElement("div");
      title.className = "session-title";
      title.textContent = truncate(session.goal, 34);
      var meta = document.createElement("div");
      meta.className = "session-meta";
      meta.textContent = formatDate(session.ts) + " · " + session.mode + (session.approved ? " · 承認済み" : "");
      item.appendChild(title);
      item.appendChild(meta);
      item.addEventListener("click", function () {
        restoreSession(session.id);
        closeSidebar();
      });
      el.sessionList.appendChild(item);
    });
  }

  function restoreSession(id) {
    if (state.running) {
      return;
    }
    var session = getSessions().find(function (s) {
      return s.id === id;
    });
    if (!session) {
      return;
    }
    state.sessionId = session.id;
    state.goal = session.goal;
    state.approved = !!session.approved;
    state.deliverableText = session.deliverable || "";
    state.messages = Array.isArray(session.messages) ? session.messages : [];
    state.agents = (session.plan || []).map(function (a) {
      return { id: a.id, role: a.role, name: a.name, title: a.title, status: "完了" };
    });

    clearError();
    el.emptyState.hidden = true;
    el.conversation.hidden = false;
    el.chatTitle.textContent = state.goal;
    clearTimeline();
    moveComposer("dock");

    addUserMessage(state.goal);
    renderPlan(state.agents);
    state.messages.forEach(function (entry) {
      if (entry.kind === "agent") {
        var body = addAgentMessage({ name: entry.name, role: entry.role });
        body.textContent = entry.text;
      } else if (entry.kind === "system") {
        addSystemMessage(entry.text);
      }
    });
    if (state.deliverableText) {
      var summarizer = state.agents.find(function (a) { return a.id === "summary"; }) || SUMMARIZER;
      addDeliverableCard(summarizer, state.deliverableText, state.approved);
    }
    renderSessions();
    scrollBottom();
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

  function fallbackTasks() {
    return [
      { role: "プランナー", title: "全体の企画と進め方をまとめる" },
      { role: "リサーチャー", title: "必要な情報を調査して整理する" },
      { role: "ライター", title: "成果物の本文ドラフトを書く" },
      { role: "レビュアー", title: "内容をチェックして改善点を指摘する" }
    ];
  }

  async function callMistral(messages, useStream, onDelta, signal) {
    var response;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + state.apiKey
        },
        body: JSON.stringify({
          model: MODEL,
          messages: messages,
          stream: !!useStream
        }),
        signal: signal || undefined
      });
    } catch (fetchErr) {
      if (fetchErr && fetchErr.name === "AbortError") {
        var cancelled = new Error("stopped");
        cancelled.cancelled = true;
        throw cancelled;
      }
      var netErr = new Error("ネットワークエラーでAPIに接続できませんでした");
      netErr.handled = true;
      throw netErr;
    }

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
        if (state.stopping) {
          clearInterval(timer);
          resolve();
          return;
        }
        index = Math.min(text.length, index + 2);
        bubble.textContent = text.slice(0, index);
        scrollBottom();
        if (index >= text.length) {
          clearInterval(timer);
          resolve();
        }
      }, speed);
    });
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function checkStop() {
    if (state.stopping) {
      var e = new Error("stopped");
      e.cancelled = true;
      throw e;
    }
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
    "レビュアー": function () {
      return "全体のレビューが完了しました。\n\n- 構成: 目的→施策→測定の順で一貫しており、問題なし\n- 文案: 対象読者に響くトーンで、法的・表現上の問題もなし\n- 改善点: KPIに「リピート来店率」を加えると、施策後の振り返りがしやすくなります\n\n上記1点を修正のうえ、まとめ役へ引き継ぎます。";
    }
  };

  var DEMO_SUMMARY_MESSAGE = "各メンバーの成果を統合して、成果物にまとめました。以下のカードから確認・ダウンロードできます。";

  var DEMO_DELIVERABLE = function (goal) {
    return "# 「" + goal + "」実行プラン\n\n## 1. 目的とターゲット\n- 目的: オープン時期の集客と認知の定着\n- ターゲット: 近隣在住の20〜40代、SNSで店舗情報を収集する層\n\n## 2. 実施期間\n- 期間: オープン初日から3週間\n- 前段: 開始1週間前にティザー告知を開始\n\n## 3. 施策\n1. 来店特典: 先着でドリンク1杯プレゼント(キャッチコピー「はじめの一杯を、特別に。」)\n2. SNS投稿企画: ハッシュタグ #はじめの一杯 の投稿でデザートを1点進呈\n3. コラボ企画: 近隣店舗との限定コラボメニューを週替わりで投入\n\n## 4. 効果測定(KPI)\n- 来店者数(前週比)\n- ハッシュタグ投稿数\n- リピート来店率\n\n## 5. ふりかえり\n- 期間終了後にKPIを振り返り、次の常設施策につなげる";
  };

  function demoAgentsFor() {
    var tasks = [
      { role: "プランナー", title: "全体の企画と構成をまとめる" },
      { role: "リサーチャー", title: "必要な情報を調査して整理する" },
      { role: "ライター", title: "成果物の本文ドラフトを書く" },
      { role: "レビュアー", title: "内容をチェックして改善点を指摘する" },
      SUMMARIZER
    ];
    return tasks.map(function (task, index) {
      return {
        id: "a" + index,
        role: task.role,
        title: task.title,
        name: task.name || agentNameForRole(task.role),
        status: "待機"
      };
    });
  }

  function addDeliverableCard(agent, text, approved) {
    var card = document.createElement("div");
    card.className = "deliverable";
    card.id = "deliverableCard";

    var head = document.createElement("div");
    head.className = "deliverable-head";
    var label = document.createElement("span");
    label.className = "deliverable-label";
    label.textContent = "成果物";
    var by = document.createElement("span");
    by.className = "deliverable-by";
    by.textContent = agent.role + " · " + agent.name;
    head.appendChild(label);
    head.appendChild(by);

    var title = document.createElement("div");
    title.className = "deliverable-title";
    title.textContent = "「" + state.goal + "」のまとめ";

    var content = document.createElement("div");
    content.className = "deliverable-content";
    content.textContent = text || "";

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
      tag.textContent = "✓ 承認済み";
      actions.insertBefore(tag, actions.firstChild);
      saveSession();
    });

    var download = document.createElement("button");
    download.className = "btn btn-ghost btn-sm";
    download.type = "button";
    download.textContent = "Markdownをダウンロード";
    download.addEventListener("click", function () {
      downloadMarkdown(state.deliverableText);
    });

    actions.appendChild(approve);
    actions.appendChild(download);

    if (approved) {
      card.classList.add("is-approved");
      approve.remove();
      var tag = document.createElement("span");
      tag.className = "approved-tag";
      tag.textContent = "✓ 承認済み";
      actions.insertBefore(tag, actions.firstChild);
    }

    card.appendChild(head);
    card.appendChild(title);
    card.appendChild(content);
    card.appendChild(actions);
    el.timeline.appendChild(card);
    scrollBottom();
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

  async function runDemo(goal) {
    var agents = demoAgentsFor();
    state.agents = agents;
    renderPlan(agents);
    addLog({ kind: "plan", plan: agents.map(function (a) { return { id: a.id, role: a.role, name: a.name, title: a.title }; }) });

    await sleep(400);
    checkStop();

    for (var i = 0; i < 4; i++) {
      var agent = agents[i];
      setAgentStatus(agent.id, "作業中");
      var bubble = addTypingIndicator(agent);
      await sleep(500);
      checkStop();
      var text = DEMO_SCRIPT[agent.role]
        ? DEMO_SCRIPT[agent.role](goal)
        : "「" + goal + "」の担当タスク「" + agent.title + "」を完了しました。";
      await typeInto(bubble, text, 14);
      checkStop();
      bubble.textContent = text;
      addLog({ kind: "agent", name: agent.name, role: agent.role, text: text });
      setAgentStatus(agent.id, "完了");
      await sleep(350);
      checkStop();
    }

    var summarizer = agents[4];
    setAgentStatus(summarizer.id, "作業中");
    var summaryBody = addAgentMessage(summarizer);
    await typeInto(summaryBody, DEMO_SUMMARY_MESSAGE, 12);
    checkStop();
    addLog({ kind: "agent", name: summarizer.name, role: summarizer.role, text: DEMO_SUMMARY_MESSAGE });

    await sleep(400);
    checkStop();

    var deliverableText = DEMO_DELIVERABLE(goal);
    state.deliverableText = deliverableText;
    var contentEl = addDeliverableCard(summarizer, "", false);
    await typeInto(contentEl, deliverableText, 6);
    checkStop();
    setAgentStatus(summarizer.id, "完了");
  }

  async function runApi(goal) {
    var controller = new AbortController();
    state.abort = controller;

    var decomposeMessages = [
      {
        role: "system",
        content: "あなたはワークスペースのオーケストレーターです。ユーザーの目標を、実行可能なタスクに分解してください。出力は必ず次のJSON形式のみ(説明文は不要): [{\"role\":\"役割名(日本語3〜6文字)\",\"title\":\"この役割が担う具体的なタスク(日本語)\"}] タスクは3〜4個。最後の統合はまとめ役が行うため、まとめ役は含めないでください。"
      },
      {
        role: "user",
        content: "目標: " + goal
      }
    ];

    var raw = await callMistral(decomposeMessages, false, null, controller.signal);
    checkStop();

    var parsed = extractJsonArray(raw);
    var tasks = Array.isArray(parsed) && parsed.length
      ? parsed.filter(function (t) { return t && t.role && t.title; }).slice(0, 4)
      : fallbackTasks();
    if (!tasks.length) {
      tasks = fallbackTasks();
    }

    var agents = tasks.map(function (task, index) {
      return {
        id: "a" + index,
        role: String(task.role),
        title: String(task.title),
        name: agentNameForRole(String(task.role)),
        status: "待機"
      };
    });
    agents.push({ id: SUMMARIZER.id, role: SUMMARIZER.role, name: SUMMARIZER.name, title: SUMMARIZER.title, status: "待機" });
    state.agents = agents;
    renderPlan(agents);
    addLog({ kind: "plan", plan: agents.map(function (a) { return { id: a.id, role: a.role, name: a.name, title: a.title }; }) });
    addSystemMessage("目標を " + (agents.length - 1) + " つのタスクに分解し、まとめ役とあわせて " + agents.length + " 人のチームで作業します。");

    var context = [];
    for (var i = 0; i < agents.length - 1; i++) {
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
        }, controller.signal);
      } catch (e) {
        setAgentStatus(agent.id, "待機");
        throw e;
      }
      checkStop();

      if (!text) {
        var emptyErr = new Error("APIから空の応答が返りました。もう一度お試しください");
        emptyErr.handled = true;
        throw emptyErr;
      }
      bubble.textContent = text;
      addLog({ kind: "agent", name: agent.name, role: agent.role, text: text });
      context.push({ role: agent.role, name: agent.name, text: text });
      setAgentStatus(agent.id, "完了");
    }

    var summarizer = agents[agents.length - 1];
    setAgentStatus(summarizer.id, "作業中");
    var summaryBody = addAgentMessage(summarizer);
    summaryBody.textContent = DEMO_SUMMARY_MESSAGE;
    addLog({ kind: "agent", name: summarizer.name, role: summarizer.role, text: DEMO_SUMMARY_MESSAGE });
    scrollBottom();

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

    var contentEl = addDeliverableCard(summarizer, "", false);
    var deliverableText = "";
    try {
      deliverableText = await callMistral(summaryMessages, true, function (full) {
        contentEl.textContent = full;
      }, controller.signal);
    } catch (e) {
      setAgentStatus(summarizer.id, "待機");
      throw e;
    }
    checkStop();

    if (!deliverableText) {
      var emptyErr2 = new Error("APIから空の応答が返りました。もう一度お試しください");
      emptyErr2.handled = true;
      throw emptyErr2;
    }

    state.deliverableText = deliverableText;
    contentEl.textContent = deliverableText;
    setAgentStatus(summarizer.id, "完了");
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
    resetRunState();
    state.goal = goal;
    showConversation();
    addUserMessage(goal);
    addLog({ kind: "user", text: goal });
    setRunning(true);

    try {
      if (isDemo()) {
        await runDemo(goal);
      } else {
        await runApi(goal);
      }
      saveSession();
    } catch (e) {
      state.agents.forEach(function (agent) {
        if (agent.status === "作業中") {
          setAgentStatus(agent.id, "待機");
        }
      });
      if (e && e.cancelled) {
        addSystemMessage("チームの作業を停止しました。");
        saveSession();
      } else if (e && e.handled) {
        showError(e.message, e.detail);
        saveSession();
      } else {
        showError("予期しないエラーが発生しました", e && e.message ? e.message : String(e));
      }
    } finally {
      setRunning(false);
      state.stopping = false;
      state.abort = null;
    }
  }

  function stopRun() {
    if (!state.running) {
      return;
    }
    state.stopping = true;
    if (state.abort) {
      try {
        state.abort.abort();
      } catch (e) {}
    }
  }

  function closeSidebar() {
    el.sidebar.classList.remove("is-open");
    el.sidebarOverlay.classList.remove("is-open");
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

  el.runButton.addEventListener("click", function () {
    if (state.running) {
      stopRun();
    } else {
      run();
    }
  });

  el.goalInput.addEventListener("input", updateSendState);

  el.goalInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (!state.running) {
        run();
      }
    }
  });

  Array.prototype.forEach.call(document.querySelectorAll(".suggestion-pill"), function (pill) {
    pill.addEventListener("click", function () {
      if (state.running) {
        return;
      }
      el.goalInput.value = pill.getAttribute("data-goal") || "";
      run();
    });
  });

  el.newTeamBtn.addEventListener("click", function () {
    if (state.running) {
      return;
    }
    showEmpty();
    closeSidebar();
  });

  el.menuToggle.addEventListener("click", function () {
    el.sidebar.classList.add("is-open");
    el.sidebarOverlay.classList.add("is-open");
  });

  el.sidebarOverlay.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeSidebar();
      closeModal();
    }
  });

  el.openSettings.addEventListener("click", openModal);

  el.settingsModal.addEventListener("click", function (e) {
    if (e.target === el.settingsModal) {
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
  applyTheme(currentTheme());
  updateModeIndicators();
  moveComposer("center");
  updateSendState();
  renderSessions();

  (function handleGoalParam() {
    var goal = "";
    try {
      var params = new URLSearchParams(window.location.search);
      goal = params.get("goal") || "";
      if (goal) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch (e) {}
    if (goal) {
      el.goalInput.value = goal;
      updateSendState();
      run();
    }
  })();
})();
