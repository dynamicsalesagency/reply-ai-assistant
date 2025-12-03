const form = document.getElementById("reply-form");
const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");
const replyTextEl = document.getElementById("replyText");
const copyBtn = document.getElementById("copyBtn");
const generateBtn = document.getElementById("generateBtn");

const profileNameEl = document.getElementById("profileName");
const profileAgencyEl = document.getElementById("profileAgency");
const profileRoleEl = document.getElementById("profileRole");
const profileSignatureEl = document.getElementById("profileSignature");
const profileSalesProofUrlsEl = document.getElementById("profileSalesProofUrls");
const profilePortfolioUrlsEl = document.getElementById("profilePortfolioUrls");
const profileStatusEl = document.getElementById("profileStatus");

const conversationNameEl = document.getElementById("conversationName");
const conversationViewEl = document.getElementById("conversationView");

const PROFILE_KEY = "replyAI_profile";
const THREADS_KEY = "replyAI_threads";

// ----- PROFILE -----
function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return;
    const profile = JSON.parse(raw);
    profileNameEl.value = profile.name || "";
    profileAgencyEl.value = profile.agency || "";
    profileRoleEl.value = profile.role || "";
    profileSignatureEl.value = profile.signature || "";
    profileSalesProofUrlsEl.value = (profile.defaultSalesProofUrls || []).join("\n");
    profilePortfolioUrlsEl.value = (profile.defaultPortfolioUrls || []).join("\n");
  } catch (e) {
    console.error("Error loading profile:", e);
  }
}

function saveProfileToStorage() {
  const profile = {
    name: profileNameEl.value.trim(),
    agency: profileAgencyEl.value.trim(),
    role: profileRoleEl.value.trim(),
    signature: profileSignatureEl.value.trim(),
    defaultSalesProofUrls: profileSalesProofUrlsEl.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    defaultPortfolioUrls: profilePortfolioUrlsEl.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

function getCurrentProfile() {
  return {
    name: profileNameEl.value.trim(),
    agency: profileAgencyEl.value.trim(),
    role: profileRoleEl.value.trim(),
    signature: profileSignatureEl.value.trim(),
    defaultSalesProofUrls: profileSalesProofUrlsEl.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    defaultPortfolioUrls: profilePortfolioUrlsEl.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

// ----- THREADS / CONVERSATIONS -----
function loadThreads() {
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error loading threads:", e);
    return {};
  }
}

function saveThreads(threads) {
  localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
}

function renderConversation(conversationName) {
  conversationViewEl.innerHTML = "";
  if (!conversationName) return;

  const threads = loadThreads();
  const thread = threads[conversationName];
  if (!thread || !thread.messages || !thread.messages.length) {
    conversationViewEl.innerHTML = '<p class="hint">No messages yet for this conversation.</p>';
    return;
  }

  thread.messages.forEach((msg) => {
    const div = document.createElement("div");
    div.classList.add("message");
    div.classList.add(msg.role === "assistant" ? "assistant" : "user");

    const roleEl = document.createElement("div");
    roleEl.classList.add("message-role");
    roleEl.textContent = msg.role === "assistant" ? "You (Reply AI)" : "Store Owner / You";

    const contentEl = document.createElement("div");
    contentEl.textContent = msg.content;

    div.appendChild(roleEl);
    div.appendChild(contentEl);
    conversationViewEl.appendChild(div);
  });

  conversationViewEl.scrollTop = conversationViewEl.scrollHeight;
}

// ----- PROFILE BUTTON -----
document.getElementById("saveProfileBtn").addEventListener("click", () => {
  saveProfileToStorage();
  profileStatusEl.textContent = "Profile saved.";
  setTimeout(() => {
    profileStatusEl.textContent = "";
  }, 2000);
});

// Load profile on start
loadProfile();

// When user changes conversation name, refresh history
conversationNameEl.addEventListener("change", () => {
  renderConversation(conversationNameEl.value.trim());
});

// ----- FORM SUBMIT -----
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const conversationName = conversationNameEl.value.trim();
  if (!conversationName) {
    statusEl.textContent = "Please enter a conversation name (e.g. store or client).";
    return;
  }

  const scoutingMessage = document.getElementById("scoutingMessage").value.trim();
  const storeOwnerReply = document.getElementById("storeOwnerReply").value.trim();

  if (!scoutingMessage || !storeOwnerReply) {
    statusEl.textContent = "Please fill in both your scouting message and the store owner's latest reply.";
    return;
  }

  // Load or init thread
  const threads = loadThreads();
  if (!threads[conversationName]) {
    threads[conversationName] = { name: conversationName, messages: [] };
  }
  const thread = threads[conversationName];

  // Append this latest buyer message to conversation history
  thread.messages.push({
    role: "user",
    content: storeOwnerReply,
  });

  // Build profile + merge default & extra links
  const profile = getCurrentProfile();

  const extraSalesProofs = document
    .getElementById("salesProofUrls")
    .value.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const extraPortfolio = document
    .getElementById("portfolioUrls")
    .value.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const allSalesProofs = [
    ...(profile.defaultSalesProofUrls || []),
    ...extraSalesProofs,
  ];

  const allPortfolio = [
    ...(profile.defaultPortfolioUrls || []),
    ...extraPortfolio,
  ];

  const data = {
    conversationHistory: thread.messages,
    salespersonProfile: {
      name: profile.name,
      agency: profile.agency,
      role: profile.role,
      signature: profile.signature,
    },
    replyName: document.getElementById("replyName").value.trim(),
    storeName: document.getElementById("storeName").value.trim(),
    storeUrl: document.getElementById("storeUrl").value.trim(),
    scoutingMessage,
    storeOwnerReply,
    tone: document.getElementById("tone").value,
    goal: document.getElementById("goal").value,
    length: document.getElementById("length").value,
    salesProofUrls: allSalesProofs,
    portfolioUrls: allPortfolio,
    extraNotes: document.getElementById("extraNotes").value.trim(),
  };

  statusEl.textContent = "Generating reply...";
  generateBtn.disabled = true;

  try {
    const res = await fetch("/api/generate-reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const json = await res.json();

    if (!res.ok) {
      statusEl.textContent = json.error || "Something went wrong.";
      generateBtn.disabled = false;
      return;
    }

    replyTextEl.textContent = json.reply;
    outputEl.classList.remove("hidden");
    statusEl.textContent = "Reply generated successfully.";

    // Add assistant reply to thread and save
    thread.messages.push({
      role: "assistant",
      content: json.reply,
    });
    threads[conversationName] = thread;
    saveThreads(threads);

    // Update conversation view
    renderConversation(conversationName);
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Network or server error.";
  }

  generateBtn.disabled = false;
});

// COPY BUTTON
copyBtn.addEventListener("click", async () => {
  const text = replyTextEl.textContent;
  try {
    await navigator.clipboard.writeText(text);
    statusEl.textContent = "Reply copied to clipboard.";
  } catch (err) {
    statusEl.textContent = "Could not copy text.";
  }
});
