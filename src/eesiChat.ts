import {
  $,
  bigFace,
  checkNetwork,
  closeSheet,
  confirmDialog,
  esc,
  face,
  fmtDate,
  getDeletedForMeSet,
  hooks,
  isManager,
  markDeletedForMe,
  openPhotoPreview,
  openSheet,
  prepareImageFile,
  profileName,
  profileOf,
  renderUserLeaveBalanceHtml,
  roleLabel,
  runtime,
  safeUrl,
  setVal,
  sheetClose,
  state,
  toast,
  val,
  isImageFile,
  isVideoUrl,
  isMissingTableError,
  buildStoryAppNoticeBody,
  suppressNotifications,
} from "./eesiTypes";
import {
  loadAppNotifications,
  loadBlockedUsers,
  loadMessages,
  loadPreviews,
  loadStories,
  loadThreads,
  onlineIds,
  saveLastView,
} from "./eesiData";
import { playSettingSound, stopSettingSound } from "./eesiSettings";

/* ==================== CHAT PREF HELPERS ==================== */
const PLANNED_FEATURES: Record<string, [string, string]> = {
  disappearing: ["Disappearing messages", "Not turned on yet."],
  receipts: ["Read receipts", "Not turned on yet."],
  typing: ["Typing indicator", "Live typing status is active."],
  permissions: ["Message permissions", "Not turned on yet."],
  e2e: ["Encryption", "Transport encrypted via TLS / Supabase."],
  block: ["Block", "Use the Block button in direct chats."],
  restrict: ["Restrict", "Not turned on yet."],
  report: ["Report", "Report issues to an administrator."],
};

function prefKey(threadId: string): string { return "eesi-chatpref:" + state.userId + ":" + threadId; }
export function getPref(threadId: string): any {
  try { return JSON.parse(localStorage.getItem(prefKey(threadId)) || "{}") || {}; } catch { return {}; }
}
function setPref(threadId: string, patch: any): void {
  localStorage.setItem(prefKey(threadId), JSON.stringify({ ...getPref(threadId), ...patch }));
}
export function isMuted(threadId: string): boolean {
  const m = getPref(threadId).mute;
  return !!m && (m === "forever" || Date.now() < m);
}
function muteText(threadId: string): string {
  if (!isMuted(threadId)) return "On";
  const m = getPref(threadId).mute;
  return m === "forever" ? "Muted until you change it" : "Muted until " + new Date(m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function isHidden(t: any): boolean {
  const h = getPref(t.id).hiddenAt;
  if (!h) return false;
  const last = (state.previews[String(t.id)] || {}).created_at || t.created_at;
  return new Date(last) <= new Date(h);
}

/* ==================== THREAD HELPERS ==================== */
export function threadMembers(t: any): any[] { return (t && t.thread_members) || []; }
export function threadTitle(t: any): string {
  if (!t) return "Chat";
  const pref = getPref(String(t.id));
  if (pref.nickname) return pref.nickname;
  if (t.kind === "group") return t.title || "Group chat";
  const other = threadMembers(t).find(m => String(m.user_id) !== String(state.userId));
  return other ? profileName(other.user_id) : (t.title || "Chat");
}
function threadAvatar(t: any): string {
  if (!t) return '<span class="avatar initial">?</span>';
  if (t.kind === "group") return '<span class="avatar initial">👥</span>';
  const other = threadMembers(t).find(m => String(m.user_id) !== String(state.userId));
  return face(other ? profileOf(other.user_id) : null);
}

function refreshChatViews(): void {
  renderChatInfo();
  renderChatList();
  hooks.renderNotices();
}

export function renderChatList(): void {
  const box = $("chatList");
  if (!box) return;
  const peopleRow = $("chatPeopleRow");
  if (peopleRow) {
    const online = onlineIds();
    const nowMs = Date.now();
    const storiesByUser = new Map<string, any[]>();
    (state.stories || []).forEach(st => {
      if (st.expires_at && new Date(st.expires_at).getTime() <= nowMs) return;
      const uid = String(st.user_id || "");
      if (!uid) return;
      if (!storiesByUser.has(uid)) storiesByUser.set(uid, []);
      storiesByUser.get(uid)!.push(st);
    });

    const myStories = storiesByUser.get(String(state.userId || "")) || [];
    const addStoryBtn =
      '<button class="story" type="button" onclick="openStoryComposer()">' +
      '<span class="bubble-av' + (myStories.length ? " story-ring" : "") + '" style="background:rgba(47,140,255,.16);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;">' +
      face(state.profile) +
      '<span style="position:absolute;right:-2px;bottom:-2px;width:18px;height:18px;border-radius:50%;background:var(--accent);color:#fff;font-size:12px;font-weight:800;display:grid;place-items:center;border:2px solid var(--bg);">＋</span>' +
      '</span><small>My Day</small></button>';

    const activeStoryBtns = [...storiesByUser.entries()]
      .filter(([, list]) => list.length > 0)
      .map(([uid, list]) => {
        const p = profileOf(uid);
        const firstName = uid === String(state.userId) ? "Your Story" : (((p?.full_name || list[0]?.sender_name || "Member").split(" ")[0]) + ` (${list.length})`);
        const on = online.has(uid);
        return '<button class="story" type="button" onclick="openStoryViewer(\'' + esc(uid) + '\')">' +
          '<span class="bubble-av story-ring">' + face(p) + (on ? '<span class="presdot"></span>' : "") + '</span>' +
          '<small>' + esc(firstName) + '</small></button>';
      });

    const memberDmBtns = state.profiles
      .filter(p => String(p.user_id) !== String(state.userId) && !storiesByUser.has(String(p.user_id)))
      .slice(0, 18)
      .map(p => {
        const on = online.has(String(p.user_id));
        return '<button class="story" type="button" data-act="open-dm" data-id="' + esc(p.user_id) + '"><span class="bubble-av">' +
          face(p) + (on ? '<span class="presdot"></span>' : "") + "</span><small>" + esc((p.full_name || "").split(" ")[0]) + "</small></button>";
      });

    peopleRow.innerHTML = addStoryBtn + activeStoryBtns.join("") + memberDmBtns.join("");
  }
  const q = val("chatSearch").trim().toLowerCase();
  const filter = state.chatFilter || "all";
  const list = state.threads
    .filter(t => {
      const hidden = isHidden(t);
      if (filter === "archived") return hidden;
      if (hidden) return false;
      if (filter === "unread") return (state.unread[String(t.id)] || 0) > 0;
      if (filter === "groups") return t.kind === "group";
      return true;
    })
    .filter(t => !q || threadTitle(t).toLowerCase().includes(q));

  list.sort((a, b) => {
    const pa = getPref(String(a.id)).pinned ? 1 : 0;
    const pb = getPref(String(b.id)).pinned ? 1 : 0;
    if (pa !== pb) return pb - pa;
    const aTime = (state.previews[String(a.id)]?.created_at) || a.created_at || "";
    const bTime = (state.previews[String(b.id)]?.created_at) || b.created_at || "";
    return bTime.localeCompare(aTime);
  });

  box.innerHTML = list.map(t => {
    const tid = String(t.id);
    const title = threadTitle(t);
    const preview = state.previews[tid];
    const unread = state.unread[tid] || 0;
    const lastTime = preview?.created_at ? new Date(preview.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
    let previewText = "No messages yet";
    if (preview) {
      if (preview.deleted_at) {
        previewText = "🚫 Message deleted";
      } else {
        previewText = preview.attachment_type?.startsWith("image/") ? "📷 Photo" : preview.attachment_name ? "📎 File" : (preview.body || "");
        if (String(preview.user_id) === String(state.userId)) previewText = "You: " + previewText;
      }
    }
    const isDirect = t.kind === "direct";
    const other = isDirect ? threadMembers(t).find(m => String(m.user_id) !== String(state.userId)) : null;
    const isOnline = other && onlineIds().has(String(other.user_id));
    return '<button class="thread-row' + (unread ? " is-unread" : "") + '" type="button" data-act="open-thread" data-id="' + esc(t.id) + '">' +
      '<span class="thread-av">' + threadAvatar(t) + (isDirect && isOnline ? '<span class="online-dot"></span>' : "") + "</span>" +
      '<span class="thread-txt"><span class="thread-top"><span class="thread-name">' + esc(title) + '</span><span class="thread-time">' + esc(lastTime) + "</span></span>" +
      '<span class="thread-sub"><span class="thread-preview">' + esc(previewText) + "</span>" + (unread ? '<span class="msgr-dot"></span>' : "") + "</span></span></button>";
  }).join("") || '<p class="muted" style="padding:20px;text-align:center;">No chats yet. Tap the pencil to start one.</p>';
}

export function updateSendBtn(): void {
  const input = $("messageText") as HTMLInputElement | null;
  const btn = $("sendBtn");
  if (!input || !btn) return;
  btn.textContent = runtime.editingMessageId ? "✓" : (input.value.trim().length > 0 ? "➤" : "👍");
}

export function cancelReply(): void {
  runtime.replyingToMsg = null;
  $("replyingIndicator")?.classList.add("hidden");
  const rn = $("replyName");
  const rp = $("replyPreview");
  if (rn) rn.textContent = "";
  if (rp) rp.textContent = "";
}

export function openCompose(): void {
  $("chatBrowser")?.classList.add("hidden");
  $("chatCompose")?.classList.remove("hidden");
  const list = $("peopleList");
  if (list) {
    list.innerHTML = state.profiles
      .filter(p => String(p.user_id) !== String(state.userId))
      .map(p =>
        '<button class="person" type="button" data-act="open-dm" data-id="' + esc(p.user_id) + '">' + face(p) +
        '<span class="person-info"><b>' + esc(p.full_name || p.email) + '</b><span class="muted">' + esc(p.team || "") + (p.area ? " · " + esc(p.area) : "") + "</span></span></button>"
      ).join("") || '<p class="muted">No other members.</p>';
  }
}

export function closeCompose(): void {
  $("chatCompose")?.classList.add("hidden");
  $("chatBrowser")?.classList.remove("hidden");
  hideGroupForm();
}

export function setChatFilter(filter: string): void {
  state.chatFilter = filter;
  document.querySelectorAll<HTMLElement>("#chatChips .chip").forEach(c => c.classList.toggle("active", c.dataset.filter === filter));
  renderChatList();
}

export function openChatInfo(): void {
  if (!state.activeThread) return;
  $("activeChat")?.classList.add("hidden");
  $("chatInfo")?.classList.remove("hidden");
  renderChatInfo();
}

export function closeChatInfo(): void {
  $("chatInfo")?.classList.add("hidden");
  $("activeChat")?.classList.remove("hidden");
}

export function toggleChatPlus(): void { $("chatPlus")?.classList.toggle("hidden"); }
export function toggleEmoji(): void { $("emojiPop")?.classList.toggle("hidden"); }
export function pickEmoji(emoji: string): void {
  const input = $("messageText") as HTMLInputElement | null;
  if (!input) return;
  input.value += emoji;
  input.focus();
  updateSendBtn();
  $("emojiPop")?.classList.add("hidden");
}

export function openActiveChatProfile(): void {
  const t = state.threads.find(x => String(x.id) === String(state.activeThread));
  if (!t || t.kind !== "direct") return;
  const m = threadMembers(t).find(x => String(x.user_id) !== String(state.userId));
  if (m) openProfileView(m.user_id);
}

export function markThreadRead(threadId: string): void {
  if (!state.userId) return;
  const now = new Date().toISOString();
  const thread = state.threads.find(t => String(t.id) === String(threadId));
  if (thread) {
    const member = (thread.thread_members || []).find((m: any) => String(m.user_id) === String(state.userId));
    if (member) member.last_read_at = now;
  }
  runtime.client
    .from("thread_members")
    .update({ last_read_at: now })
    .eq("thread_id", threadId)
    .eq("user_id", state.userId)
    .then(({ error }: any) => { if (error) console.warn("read receipt", error.message); });
  if (state.unread[String(threadId)]) {
    delete state.unread[String(threadId)];
    renderChatList();
    hooks.renderHome();
    hooks.renderNotices();
  }
}

let activeThreadToken = 0;
let typingChannel: any = null;
let typingTimeout: any = null;
let typingSendTimeout: any = null;

export function clearTyping(): void {
  if (typingChannel && runtime.client) {
    runtime.client.removeChannel(typingChannel);
    typingChannel = null;
  }
  clearTimeout(typingTimeout);
  typingTimeout = null;
  clearTimeout(typingSendTimeout);
  typingSendTimeout = null;
}

export async function openThread(id: string): Promise<void> {
  const t = state.threads.find(x => String(x.id) === String(id));
  if (!t) return;
  const myToken = ++activeThreadToken;
  state.activeThread = String(t.id);
  state.messages = [];
  hooks.go("chat");
  $("chatCompose")?.classList.add("hidden");
  $("chatInfo")?.classList.add("hidden");
  $("chatBrowser")?.classList.add("hidden");
  $("activeChat")?.classList.remove("hidden");

  const titleEl = $("chatTitle");
  if (titleEl) titleEl.textContent = threadTitle(t);
  $("callAudioBtn")?.classList.toggle("hidden", t.kind !== "direct");
  $("callVideoBtn")?.classList.toggle("hidden", t.kind !== "direct");
  const headAv = $("chatHeadAv");
  if (headAv) headAv.innerHTML = threadAvatar(t);

  const other = t.kind === "direct" ? threadMembers(t).find(m => String(m.user_id) !== String(state.userId)) : null;
  const statusEl = $("chatStatus");
  if (statusEl) {
    statusEl.textContent = t.kind === "group"
      ? threadMembers(t).length + " members"
      : (other && onlineIds().has(String(other.user_id)) ? "Active now" : "Offline");
  }
  const isBlocked = !!(other && state.blockedUsers.some(b => String(b) === String(other.user_id)));
  document.querySelector(".chat-composer")?.classList.toggle("hidden", isBlocked);

  const msgBox = $("messages");
  if (msgBox) msgBox.innerHTML = '<p class="muted">Loading messages…</p>';
  await loadMessages(String(t.id));
  if (myToken !== activeThreadToken || String(state.activeThread) !== String(t.id)) return;
  markThreadRead(String(t.id));
  renderChatList();
  saveLastView();

  if (typingChannel && runtime.client) runtime.client.removeChannel(typingChannel);
  typingChannel = runtime.client.channel("typing-" + t.id);
  typingChannel
    .on("broadcast", { event: "typing" }, ({ payload }: any) => {
      if (String(payload.user_id) === String(state.userId)) return;
      if (statusEl) statusEl.textContent = payload.name + " is typing...";
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        const otherInner = t.kind === "direct" ? threadMembers(t).find(m => String(m.user_id) !== String(state.userId)) : null;
        if (statusEl) {
          statusEl.textContent = t.kind === "group"
            ? threadMembers(t).length + " members"
            : (otherInner && onlineIds().has(String(otherInner.user_id)) ? "Active now" : "Offline");
        }
      }, 2000);
    })
    .subscribe();
}

export async function openDirect(otherId: string): Promise<void> {
  if (!state.userId) { toast("Sign in first"); return; }
  if (!otherId || String(otherId) === String(state.userId)) { toast("Choose another member"); return; }
  let thread = state.threads.find(
    t =>
      t.kind === "direct" &&
      threadMembers(t).length === 2 &&
      threadMembers(t).some(m => String(m.user_id) === String(state.userId)) &&
      threadMembers(t).some(m => String(m.user_id) === String(otherId))
  );
  if (!thread) {
    const { data: threadId, error: rpcError } = await runtime.client.rpc("get_or_create_direct_thread", { other_user_id: otherId });
    if (rpcError) { toast("Could not start chat: " + rpcError.message); return; }
    const { data: newThread, error: threadError } = await runtime.client
      .from("threads")
      .select("id,kind,title,created_at,thread_members(user_id,last_read_at)")
      .eq("id", threadId)
      .maybeSingle();
    if (threadError) { toast("Thread created, but loading failed: " + threadError.message); return; }
    thread = newThread;
    if (thread && !state.threads.some(t => String(t.id) === String(thread.id))) state.threads.unshift(thread);
  }
  if (!thread) { toast("Could not open the chat."); return; }
  await loadPreviews();
  await openThread(String(thread.id));
}

export function closeChat(): void {
  activeThreadToken++;
  state.activeThread = null;
  state.messages = [];
  $("activeChat")?.classList.add("hidden");
  $("chatCompose")?.classList.add("hidden");
  $("chatInfo")?.classList.add("hidden");
  $("chatBrowser")?.classList.remove("hidden");
  renderChatList();
  saveLastView();
}

export function showGroupForm(): void {
  $("groupForm")?.classList.remove("hidden");
  const box = $("groupChoices");
  if (box) {
    box.innerHTML = state.profiles
      .filter(p => String(p.user_id) !== String(state.userId))
      .map(p => '<label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" value="' + esc(p.user_id) + '" style="width:auto"> ' + esc(p.full_name || p.email) + "</label>")
      .join("") || '<p class="muted">No other members.</p>';
  }
}
export function hideGroupForm(): void { $("groupForm")?.classList.add("hidden"); }

export async function createGroup(): Promise<void> {
  if (!checkNetwork()) return;
  const button = document.querySelector('#chatCompose button[onclick="createGroup()"]') as HTMLButtonElement | null;
  const name = val("groupName").trim();
  const ids = [...new Set([...document.querySelectorAll<HTMLInputElement>("#groupChoices input:checked")].map(i => i.value).filter(id => id && String(id) !== String(state.userId)))];
  if (!name) { toast("Enter a group name."); return; }
  if (!ids.length) { toast("Select at least one other member."); return; }
  if (button) button.disabled = true;
  try {
    const { data: newId, error: rpcError } = await runtime.client.rpc("create_group_thread", { p_title: name, p_member_ids: ids });
    if (rpcError) throw rpcError;
    setVal("groupName", "");
    hideGroupForm();
    await loadThreads();
    const loadedThread = state.threads.find(item => String(item.id) === String(newId));
    if (loadedThread) await openThread(String(loadedThread.id));
    toast("Group created.");
  } catch (error: any) {
    toast("Group error: " + (error.message || String(error)));
  } finally {
    if (button) button.disabled = false;
  }
}

export async function sendMessage(text: string, file: File | null): Promise<void> {
  const t = state.threads.find(x => String(x.id) === String(state.activeThread));
  if (t && t.kind === "direct") {
    const other = threadMembers(t).find(m => String(m.user_id) !== String(state.userId));
    if (other && state.blockedUsers.some(b => String(b) === String(other.user_id))) {
      toast("You blocked this user. Unblock them to send messages.");
      return;
    }
  }
  if (!checkNetwork()) return;
  const MAX_FILE_MB = 100;
  text = (text || "").trim();
  if (!text && !file) text = "👍";
  if (!state.activeThread) { toast("Open a chat first"); return; }

  const tempId = "temp-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  const replyId = runtime.replyingToMsg ? Number(runtime.replyingToMsg.id) : null;
  const localPreviewUrl = file ? URL.createObjectURL(file) : "";
  const isImgAttachment = file ? isImageFile(file) : false;
  const tempMsg: any = {
    id: tempId,
    thread_id: state.activeThread,
    user_id: state.userId,
    sender_name: state.profile?.full_name || state.email,
    body: text,
    attachment_name: file?.name || null,
    attachment_type: file ? (file.type || (isImgAttachment ? "image/jpeg" : "file")) : null,
    localPreviewUrl,
    created_at: new Date().toISOString(),
    isOptimistic: true,
    reply_to_id: replyId,
  };
  state.messages.push(tempMsg);
  renderMessages();
  if (file) cancelReply();

  try {
    let attachment: Record<string, any> = {};
    if (file) {
      let uploadFile = file;
      if (isImgAttachment) {
        uploadFile = await prepareImageFile(uploadFile, 1600, 0.85);
      }
      if (uploadFile.size > MAX_FILE_MB * 1024 * 1024) throw new Error("File too large — max " + MAX_FILE_MB + "MB");
      const path = state.userId + "/" + Date.now() + "-" + uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const { error: upErr } = await runtime.client.storage.from("chat").upload(path, uploadFile, { upsert: false, contentType: uploadFile.type || undefined });
      if (upErr) throw upErr;
      const { data: pub } = runtime.client.storage.from("chat").getPublicUrl(path);
      attachment = { attachment_url: pub.publicUrl, attachment_name: uploadFile.name, attachment_type: uploadFile.type || (isImgAttachment ? "image/jpeg" : "file") };
    }
    const payload = {
      thread_id: state.activeThread,
      user_id: state.userId,
      sender_name: state.profile?.full_name || state.email,
      body: text,
      reply_to_id: replyId,
      ...attachment,
    };
    const { data, error } = await runtime.client.from("messages").insert(payload).select().single();
    if (error) throw error;
    state.messages = state.messages.map(m => (String(m.id) === tempId ? data : m));
    renderMessages();
    state.previews[String(state.activeThread)] = data;
    markThreadRead(state.activeThread);
    cancelReply();
  } catch (error: any) {
    toast("Could not send: " + error.message);
    state.messages = state.messages.filter(m => String(m.id) !== tempId);
    renderMessages();
  } finally {
    if (localPreviewUrl) setTimeout(() => URL.revokeObjectURL(localPreviewUrl), 1500);
  }
}

export function renderMessages(): void {
  if (!state.activeThread) return;
  const box = $("messages");
  if (!box) return;
  const q = val("messageSearch").trim().toLowerCase();
  const deletedForMe = getDeletedForMeSet();
  const filtered = state.messages.filter(m => {
    if (deletedForMe.has(String(m.id))) return false;
    if (!q) return true;
    if (m.deleted_at) return "message deleted".includes(q);
    return (m.body || "").toLowerCase().includes(q) || (m.attachment_name || "").toLowerCase().includes(q);
  });
  const t = state.threads.find(x => String(x.id) === String(state.activeThread));
  const nicknames = getPref(String(state.activeThread)).memberNicknames || {};

  box.innerHTML = filtered.map(m => {
    const mine = String(m.user_id) === String(state.userId);
    const isDeletedAll = !!m.deleted_at;
    const time = fmtDate(m.created_at) + (m.isOptimistic ? " · ⚡" : "");
    const avatar = (!mine && t && t.kind === "group") ? face(profileOf(m.user_id)) : "";
    const displayName = nicknames[m.user_id] || m.sender_name || "Member";
    const sender = mine ? "" : '<div class="muted" style="font-size:11px;margin-bottom:2px;">' + esc(displayName) + "</div>";
    let attach = "";
    if (!isDeletedAll && (m.attachment_url || m.localPreviewUrl)) {
      const url = m.localPreviewUrl ? String(m.localPreviewUrl) : safeUrl(m.attachment_url);
      if (url) {
        const isImg = (m.attachment_type || "").startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|heic|heif|avif)(\?|$)/i.test(m.attachment_name || "");
        attach = isImg
          ? '<img class="chat-img" src="' + esc(url) + '" alt="' + esc(m.attachment_name || "Photo") + '"' + (!m.isOptimistic ? ' data-preview-url="' + esc(url) + '" data-preview-label="' + esc(m.attachment_name || "Photo") + '"' : "") + ">"
          : '<a href="' + esc(url) + '" target="_blank" rel="noopener" style="color:inherit;">📎 ' + esc(m.attachment_name || "File") + "</a>";
      }
    }
    let reply = "";
    if (!isDeletedAll && m.reply_to_id) {
      const orig = state.messages.find(x => String(x.id) === String(m.reply_to_id));
      if (orig) {
        const origTxt = orig.deleted_at ? "Message deleted" : (orig.body || "");
        reply = '<div class="reply-header">↩️ ' + esc(orig.sender_name || "Member") + ": " + esc(origTxt.slice(0, 40)) + (origTxt.length > 40 ? "…" : "") + "</div>";
      }
    }
    const counts: Record<string, number> = {};
    if (!isDeletedAll) {
      (m.message_reactions || []).forEach((r: any) => { if (r.emoji) counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
    }
    const badgeHtml = Object.entries(counts).map(([emoji, c]) => esc(emoji) + (c > 1 ? c : "")).join(" ");
    const reactionBadge = badgeHtml ? '<div class="msg-reaction-badge clickable" data-act="remove-my-reaction" data-id="' + esc(m.id) + '">' + badgeHtml + "</div>" : "";
    const edited = !isDeletedAll && m.edited_at ? " (edited)" : "";
    const body = isDeletedAll
      ? '<span style="font-style:italic;opacity:0.78;">🚫 Message deleted</span>'
      : esc(m.body || "");
    return (!isDeletedAll && m.is_pinned ? '<div class="pin-above' + (mine ? " mine" : "") + '">📌 Pinned message</div>' : "") +
      '<div class="msgr-row' + (mine ? " mine" : "") + '">' + avatar +
      '<div class="msgr-bub" data-message-id="' + esc(m.id) + '" data-own-message="' + (mine ? "1" : "0") + '" data-deleted="' + (isDeletedAll ? "1" : "0") + '" data-text="' + esc(isDeletedAll ? "" : (m.body || "")) + '" data-user-id="' + esc(m.user_id) + '">' +
      sender + reply + body + attach + reactionBadge +
      '<div style="display:flex;justify-content:flex-end;align-items:center;margin-top:4px;"><small class="msgr-time" style="margin:0;margin-right:auto;">' + esc(time) + edited + "</small></div></div></div>";
  }).join("") || '<p class="muted" style="text-align:center;padding:20px;">No messages yet.</p>';

  box.scrollTop = box.scrollHeight;
  updateSendBtn();
  autoSavePhotos();
}

/* ==================== CHAT INFO PANELS & SHEETS ==================== */
function infoSection(title: string, inner: string): string {
  return '<div class="info-section"><div class="info-label">' + esc(title) + "</div>" + inner + "</div>";
}
function infoRow(icon: string, label: string, value: string, act: string, id: string, cls = ""): string {
  return '<button class="info-row' + (cls ? " " + cls : "") + '" type="button" data-act="' + act + '" data-id="' + esc(id) + '"><span class="info-ic">' +
    icon + '</span><span class="info-txt"><span>' + esc(label) + "</span>" + (value ? '<small class="muted">' + esc(value) + "</small>" : "") + "</span></button>";
}
function mediaHtml(): string {
  const shared = state.messages.filter(m => !m.deleted_at && m.attachment_url && safeUrl(m.attachment_url));
  const imgs = shared.filter(m => (m.attachment_type || "").startsWith("image/"));
  const files = shared.length - imgs.length;
  const thumbs = imgs.slice(-4).reverse().map(m => {
    const u = safeUrl(m.attachment_url)!;
    return '<img src="' + esc(u) + '" alt="" data-preview-url="' + esc(u) + '" data-preview-label="' + esc(m.attachment_name || "Photo") + '">';
  }).join("");
  return (thumbs ? '<div class="media-grid">' + thumbs + "</div>" : '<p class="muted">No photos yet.</p>') +
    infoRow("🖼", "View all media, files & links", imgs.length + " photo(s), " + files + " file(s)", "chat-media", String(state.activeThread || ""));
}

function directInfoHtml(t: any): string {
  const other = threadMembers(t).find(m => String(m.user_id) !== String(state.userId));
  const p = profileOf(other && other.user_id);
  const name = threadTitle(t);
  const pref = getPref(String(t.id));
  const otherId = other ? String(other.user_id) : "";
  const isBlocked = otherId && state.blockedUsers.some(b => String(b) === otherId);
  const profileHeader =
    '<div class="info-head" style="padding:20px 0 10px;">' + bigFace(p) +
    '<h2 style="font-size:24px;font-weight:bold;margin:12px 0 8px;">' + esc(name) + "</h2>" +
    '<button class="gray small-btn" style="border-radius:20px;padding:6px 16px;font-size:13px;margin-bottom:24px;" onclick="openActiveStatusSheet()">👤 Active status</button>' +
    '<div style="display:flex;justify-content:center;gap:28px;flex-wrap:wrap;">' +
    '<div style="text-align:center;font-size:12px;cursor:pointer;" onclick="openProfileView(\'' + esc(otherId) + '\')"><div style="width:44px;height:44px;background:rgba(47,140,255,.15);border:1px solid var(--border);border-radius:50%;display:grid;place-items:center;font-size:20px;margin:0 auto 6px;">👤</div>Profile</div>' +
    '<div style="text-align:center;font-size:12px;cursor:pointer;" onclick="openNicknamesSheet(\'' + esc(t.id) + '\')"><div style="width:44px;height:44px;background:rgba(47,140,255,.15);border:1px solid var(--border);border-radius:50%;display:grid;place-items:center;font-size:20px;margin:0 auto 6px;">Aa</div>Nicknames</div>' +
    '<div style="text-align:center;font-size:12px;cursor:pointer;" onclick="openSearchInChatSheet()"><div style="width:44px;height:44px;background:rgba(47,140,255,.15);border:1px solid var(--border);border-radius:50%;display:grid;place-items:center;font-size:20px;margin:0 auto 6px;">🔍</div>Search</div>' +
    '<div style="text-align:center;font-size:12px;cursor:pointer;" onclick="openCustomizeSheet(\'' + esc(t.id) + '\')"><div style="width:44px;height:44px;background:rgba(47,140,255,.15);border:1px solid var(--border);border-radius:50%;display:grid;place-items:center;font-size:20px;margin:0 auto 6px;">🎨</div>Customize</div>' +
    "</div></div>";
  return profileHeader +
    infoSection("Chat info", mediaHtml() + infoRow("📌", "Pinned messages", "", "open-pinned-sheet", String(t.id))) +
    infoSection("Actions",
      infoRow("🔕", isMuted(String(t.id)) ? "Unmute" : "Mute", muteText(String(t.id)), "new-mute", String(t.id)) +
      infoRow("📥", "Auto-save photos", pref.autosave ? "On" : "Off", "new-autosave", String(t.id)) +
      infoRow("📇", "Share contact", "", "chat-share", otherId)
    ) +
    infoSection("Privacy & support",
      infoRow("🔒", "Encryption", "TLS / Supabase", "new-e2e", String(t.id)) +
      infoRow("👁", "Read receipts", pref.receipts !== false ? "On" : "Off", "new-receipts", String(t.id)) +
      infoRow("💬", "Typing indicator", pref.typing !== false ? "On" : "Off", "new-typing", String(t.id)) +
      infoRow("⛔", isBlocked ? "Unblock" : "Block", "", "new-block-dm", String(t.id), "danger") +
      infoRow("🗑", isHidden(t) ? "Unarchive chat" : "Archive chat", "", "chat-delete", String(t.id), "danger")
    );
}

function groupInfoHtml(t: any): string {
  const members = threadMembers(t);
  const pref = getPref(String(t.id));
  const name = threadTitle(t);
  const groupAvatar = '<div class="big-av big-init">👥</div>';
  const profileHeader =
    '<div class="info-head" style="padding:20px 0 10px;">' + groupAvatar +
    '<h2 style="font-size:24px;font-weight:bold;margin:12px 0 8px;">' + esc(name) + "</h2>" +
    '<div style="display:flex;justify-content:center;gap:28px;flex-wrap:wrap;margin-top:16px;">' +
    '<div style="text-align:center;font-size:12px;cursor:pointer;" onclick="openMembersSheet(\'' + esc(t.id) + '\')"><div style="width:44px;height:44px;background:rgba(47,140,255,.15);border:1px solid var(--border);border-radius:50%;display:grid;place-items:center;font-size:20px;margin:0 auto 6px;">👥</div>Members</div>' +
    '<div style="text-align:center;font-size:12px;cursor:pointer;" onclick="openNicknamesSheet(\'' + esc(t.id) + '\')"><div style="width:44px;height:44px;background:rgba(47,140,255,.15);border:1px solid var(--border);border-radius:50%;display:grid;place-items:center;font-size:20px;margin:0 auto 6px;">Aa</div>Nicknames</div>' +
    '<div style="text-align:center;font-size:12px;cursor:pointer;" onclick="openSearchInChatSheet()"><div style="width:44px;height:44px;background:rgba(47,140,255,.15);border:1px solid var(--border);border-radius:50%;display:grid;place-items:center;font-size:20px;margin:0 auto 6px;">🔍</div>Search</div>' +
    '<div style="text-align:center;font-size:12px;cursor:pointer;" onclick="openCustomizeSheet(\'' + esc(t.id) + '\')"><div style="width:44px;height:44px;background:rgba(47,140,255,.15);border:1px solid var(--border);border-radius:50%;display:grid;place-items:center;font-size:20px;margin:0 auto 6px;">🎨</div>Customize</div>' +
    "</div></div>";
  const faces = members.map(m => profileOf(m.user_id)).filter(Boolean).slice(0, 7).map(p => '<span class="mini-av">' + face(p) + "</span>").join("");
  return profileHeader +
    infoRow("📌", "Pinned messages", "", "open-pinned-sheet", String(t.id)) +
    infoSection("Members",
      '<div class="member-strip">' + faces + "</div>" +
      infoRow("👥", members.length + " members", "See all", "chat-members", String(t.id)) +
      infoRow("➕", "Add people", "", "chat-add", String(t.id))
    ) +
    infoSection("Actions",
      infoRow("🔕", isMuted(String(t.id)) ? "Unmute" : "Mute", muteText(String(t.id)), "new-mute", String(t.id)) +
      infoRow("📥", "Auto-save photos", pref.autosave ? "On" : "Off", "new-autosave", String(t.id))
    ) +
    infoSection("Privacy & support",
      infoRow("🚪", "Leave chat", "", "new-leave", String(t.id), "danger") +
      infoRow("🗑", isHidden(t) ? "Unarchive chat" : "Archive chat", "", "chat-delete", String(t.id), "danger")
    );
}

export function renderChatInfo(): void {
  const t = state.threads.find(x => String(x.id) === String(state.activeThread));
  if (!t || $("chatInfo")?.classList.contains("hidden")) return;
  const body = $("chatInfoBody");
  if (body) body.innerHTML = t.kind === "group" ? groupInfoHtml(t) : directInfoHtml(t);
}

export async function removeMyReaction(id: string): Promise<void> {
  const msg = state.messages.find(m => String(m.id) === String(id));
  if (!msg || !msg.message_reactions) return;
  const myReaction = msg.message_reactions.find((r: any) => String(r.user_id) === String(state.userId));
  if (!myReaction) { toast("You haven't reacted to this message."); return; }
  const { error } = await runtime.client.rpc("react_to_message", { p_message_id: Number(id), p_emoji: myReaction.emoji });
  if (error) { toast("Could not remove reaction: " + error.message); return; }
  toast("Reaction removed");
  if (state.activeThread) await loadMessages(state.activeThread);
}

export function openCustomizeSheet(threadId: string): void {
  const p = getPref(threadId);
  openSheet(
    '<h2>Customize</h2><label class="check-row"><input type="checkbox" id="prefAutosave" ' + (p.autosave ? "checked" : "") +
    '> Auto-save photos</label><label class="check-row"><input type="checkbox" id="prefPinned" ' + (p.pinned ? "checked" : "") +
    '> Pin chat to top</label><button class="btn" style="width:100%;margin-top:10px" onclick="saveCustomize(\'' + esc(threadId) + "')\">Save</button>" + sheetClose()
  );
}
export function saveCustomize(threadId: string): void {
  setPref(threadId, {
    autosave: ($("prefAutosave") as HTMLInputElement | null)?.checked || false,
    pinned: ($("prefPinned") as HTMLInputElement | null)?.checked || false,
  });
  closeSheet();
  renderChatList();
  renderChatInfo();
  toast("Saved");
}
export function openMembersSheet(threadId: string): void {
  const t = state.threads.find(x => String(x.id) === String(threadId));
  if (!t) return;
  const rows = threadMembers(t).map(m => {
    const p = profileOf(m.user_id);
    return '<div class="person">' + face(p) + '<span class="person-info"><b>' + esc(p ? p.full_name : "Member") +
      '</b><span class="muted">' + (onlineIds().has(String(m.user_id)) ? "Online" : "Offline") + "</span></span></div>";
  }).join("");
  openSheet("<h2>Members</h2>" + rows + sheetClose());
}
export function openSearchInChatSheet(): void { closeSheet(); ($("messageSearch") as HTMLInputElement | null)?.focus(); }
export function openPinnedSheet(_threadId: string): void {
  const pinned = state.messages.filter(m => m.is_pinned && !m.deleted_at);
  openSheet("<h2>Pinned messages</h2>" + (pinned.map(m => '<div class="item"><b>' + esc(m.sender_name || "Member") + "</b><div>" + esc(m.body || "") + "</div></div>").join("") || '<p class="muted">No pinned messages.</p>') + sheetClose());
}
export function openProfileView(userId: string): void {
  const p = profileOf(userId);
  if (!p) return;
  const role = state.roles[userId] ? roleLabel(state.roles[userId].app_role) : "Member";
  const isMe = String(userId) === String(state.userId);
  const actionsHtml = !isMe
    ? '<div style="display:flex;gap:10px;margin-top:20px;"><button class="btn" style="flex:1;" onclick="closeSheet(); openDM(\'' + esc(userId) + '\')">💬 Send Message</button></div>'
    : "";
  openSheet(
    '<div class="info-head">' + bigFace(p) + "<h2>" + esc(p.full_name || "Member") + '</h2><p class="muted">' + esc(role) + '</p></div><div class="info-section">' +
    '<div class="pv-row"><span>ID No.</span><span>' + esc(p.id_no || "—") + "</span></div>" +
    '<div class="pv-row"><span>Team</span><span>' + esc(p.team || "—") + "</span></div>" +
    '<div class="pv-row"><span>Area</span><span>' + esc(p.area || "—") + "</span></div>" +
    '<div class="pv-row"><span>Phone</span><span>' + esc(p.phone || "—") + "</span></div>" +
    '<div class="pv-row"><span>Email</span><span>' + esc(p.email || "—") + "</span></div>" +
    '</div><div class="info-section"><div class="info-label">Annual Leave Balance</div>' +
    renderUserLeaveBalanceHtml(userId) +
    "</div>" + actionsHtml + sheetClose()
  );
}
export function openActiveStatusSheet(): void {
  openSheet('<h2>Active status</h2><p class="muted">Shows a green dot while you have the app open.</p>' + sheetClose());
}
function autoSavePhotos(): void {
  const pref = state.activeThread && getPref(state.activeThread);
  if (!pref || !pref.autosave) return;
  state.messages.filter(m => m.attachment_url && (m.attachment_type || "").startsWith("image/") && !m._saved).slice(-1).forEach(m => { m._saved = true; });
}
export function openNicknamesSheet(threadId: string): void {
  const t = state.threads.find(x => String(x.id) === String(threadId));
  if (!t) return;
  const members = threadMembers(t);
  const pref = getPref(threadId);
  if (t.kind === "direct") {
    const other = members.find(m => String(m.user_id) !== String(state.userId));
    const p = profileOf(other?.user_id);
    openSheet(
      '<h2>Nicknames</h2><p class="muted">Set a nickname for ' + esc(p?.full_name || "this member") + '</p>' +
      '<div class="field"><input type="text" id="nicknameInput" value="' + esc(pref.nickname || "") + '" placeholder="Nickname"></div>' +
      '<button class="btn" style="width:100%;margin-top:8px;" onclick="saveNickname(\'' + esc(threadId) + "')\">Save Nickname</button>" + sheetClose()
    );
  } else {
    const currentNicks = pref.memberNicknames || {};
    const otherMembers = members.filter(m => String(m.user_id) !== String(state.userId));
    let html = '<h2>Group Nicknames</h2><p class="muted">Set nicknames for members inside this group.</p>';
    html += otherMembers.map(m => {
      const p = profileOf(m.user_id);
      return '<div class="field" style="margin-bottom:12px;"><label>' + esc(p?.full_name || "Member") + '</label><input type="text" id="nick-' + esc(m.user_id) + '" value="' + esc(currentNicks[m.user_id] || "") + '" placeholder="Enter nickname"></div>';
    }).join("");
    html += '<button class="btn" style="width:100%;margin-top:8px;" onclick="saveGroupNicknames(\'' + esc(threadId) + "')\">Save All Nicknames</button>" + sheetClose();
    openSheet(html);
  }
}
export function saveNickname(threadId: string): void {
  setPref(threadId, { nickname: val("nicknameInput").trim() });
  toast("Nickname saved!");
  closeSheet();
  renderChatInfo();
  renderChatList();
}
export function saveGroupNicknames(threadId: string): void {
  const t = state.threads.find(x => String(x.id) === String(threadId));
  if (!t) return;
  const currentPrefs = getPref(threadId);
  const nicknames = currentPrefs.memberNicknames || {};
  threadMembers(t).filter(m => String(m.user_id) !== String(state.userId)).forEach(m => {
    const input = document.getElementById("nick-" + m.user_id) as HTMLInputElement | null;
    if (input) {
      const v = input.value.trim();
      if (v) nicknames[m.user_id] = v;
      else delete nicknames[m.user_id];
    }
  });
  setPref(threadId, { memberNicknames: nicknames });
  toast("All nicknames saved!");
  closeSheet();
  renderChatInfo();
  renderChatList();
}

export async function addMemberToGroup(threadId: string, userId: string): Promise<void> {
  const { error } = await runtime.client.from("thread_members").insert({ thread_id: threadId, user_id: userId });
  if (error) { toast("Could not add: " + error.message); return; }
  closeSheet();
  await loadThreads();
  renderChatInfo();
  toast("Member added");
}

export async function handleChatInfoAction(act: string, threadId: string): Promise<void> {
  const pref = getPref(threadId);
  const t = state.threads.find(x => String(x.id) === String(threadId));
  const other = t && t.kind === "direct" ? threadMembers(t).find(m => String(m.user_id) !== String(state.userId)) : null;

  if (act === "chat-media") {
    const imgs = state.messages.filter(m => !m.deleted_at && (m.attachment_type || "").startsWith("image/") && safeUrl(m.attachment_url));
    openSheet(
      "<h2>Media</h2>" +
      (imgs.map(m => {
        const u = safeUrl(m.attachment_url)!;
        return '<div class="media-item clickable" data-preview-url="' + esc(u) + '" data-preview-label="' + esc(m.attachment_name || "Photo") + '"><img src="' + esc(u) + '" alt=""><span class="media-name">' + esc(m.attachment_name || "Photo") + "</span></div>";
      }).join("") || '<p class="muted">No media yet.</p>') + sheetClose()
    );
    return;
  }
  if (act === "open-pinned-sheet") { openPinnedSheet(threadId); return; }
  if (act === "chat-members") { openMembersSheet(threadId); return; }
  if (act === "chat-add" && t) {
    const existing = new Set(threadMembers(t).map(m => String(m.user_id)));
    const candidates = state.profiles.filter(p => !existing.has(String(p.user_id)));
    openSheet(
      "<h2>Add people</h2>" +
      (candidates.map(p => '<button class="sheet-btn" onclick="addMemberToGroup(\'' + esc(t.id) + "','" + esc(p.user_id) + '\')">➕ ' + esc(p.full_name) + "</button>").join("") || '<p class="muted">Everyone is already in this group.</p>') +
      sheetClose()
    );
    return;
  }
  if (act === "new-autosave") { setPref(threadId, { autosave: !pref.autosave }); refreshChatViews(); toast("Auto-save " + (!pref.autosave ? "on" : "off")); return; }
  if (act === "new-mute") { const willMute = !isMuted(threadId); setPref(threadId, { mute: willMute ? "forever" : null }); refreshChatViews(); toast(willMute ? "Muted" : "Unmuted"); return; }
  if (act === "new-receipts") { setPref(threadId, { receipts: pref.receipts === false }); refreshChatViews(); return; }
  if (act === "new-typing") { setPref(threadId, { typing: pref.typing === false }); refreshChatViews(); return; }
  if (act === "chat-share") {
    const p = profileOf(threadId);
    if (p) {
      await navigator.clipboard.writeText((p.full_name || "") + " · " + (p.phone || p.email || "")).catch(() => {});
      toast("Contact copied");
    }
    return;
  }
  if (act === "new-block-dm" && other) {
    const isBlocked = state.blockedUsers.some(b => String(b) === String(other.user_id));
    if (isBlocked) {
      await runtime.client.from("user_blocks").delete().eq("blocker_id", state.userId).eq("blocked_id", other.user_id);
      toast("Unblocked");
    } else {
      if (!(await confirmDialog("Block this member?", "Block member"))) return;
      await runtime.client.from("user_blocks").insert({ blocker_id: state.userId, blocked_id: other.user_id });
      toast("Blocked");
    }
    await loadBlockedUsers();
    renderChatInfo();
    document.querySelector(".chat-composer")?.classList.toggle("hidden", !isBlocked);
    return;
  }
  if (act === "chat-delete") {
    const h = pref.hiddenAt;
    setPref(threadId, { hiddenAt: h ? null : new Date().toISOString() });
    refreshChatViews();
    closeChat();
    toast(h ? "Chat restored" : "Chat archived");
    return;
  }
  if (act === "new-leave" && t) {
    if (!(await confirmDialog("Leave this group?", "Leave chat"))) return;
    await runtime.client.from("thread_members").delete().eq("thread_id", t.id).eq("user_id", state.userId);
    closeChat();
    await loadThreads();
    toast("Left the group");
    return;
  }
  const planned = PLANNED_FEATURES[act.replace("new-", "")];
  if (planned) openSheet("<h2>" + esc(planned[0]) + '</h2><p class="muted">' + esc(planned[1]) + "</p>" + sheetClose());
}

/* ==================== CALLS (WebRTC + Supabase Broadcast) ==================== */
const RTC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };
const RING_MS = 30000;
let callChannel: any = null;
const peerChannels: Record<string, any> = {};
let call: any = null;
let incoming: any = null;
let incomingTimer: any = null;

function callTopic(userId: string): string { return "eesi-call-" + userId; }

export function startCallListener(): void {
  stopCallListener();
  if (!state.userId || !runtime.client) return;
  callChannel = runtime.client
    .channel(callTopic(state.userId), { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "call" }, ({ payload }: any) => onCallSignal(payload))
    .subscribe();
}

export function stopCallListener(): void {
  if (callChannel && runtime.client) { runtime.client.removeChannel(callChannel); callChannel = null; }
  Object.keys(peerChannels).forEach(k => {
    if (runtime.client) runtime.client.removeChannel(peerChannels[k]);
    delete peerChannels[k];
  });
}

function sendTo(peerId: string, payload: any): Promise<any> {
  if (!peerChannels[peerId]) {
    peerChannels[peerId] = runtime.client.channel(callTopic(peerId), { config: { broadcast: { self: false } } });
  }
  const ch = peerChannels[peerId];
  const doSend = () => ch.send({ type: "broadcast", event: "call", payload: { ...payload, from: state.userId, to: peerId } });
  if (ch.state === "joined") return doSend();
  return new Promise(resolve => {
    let settled = false;
    const finish = (res?: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(res);
    };
    const timer = setTimeout(() => finish(null), 5000);
    ch.subscribe((status: string) => {
      if (status === "SUBSCRIBED" && ch.state === "joined") finish(doSend());
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") finish(null);
    });
  });
}

function plain(desc: RTCSessionDescriptionInit | null) { return desc ? { type: desc.type, sdp: desc.sdp } : null; }
function waitForIce(pc: RTCPeerConnection): Promise<void> {
  return new Promise(resolve => {
    if (pc.iceGatheringState === "complete") { resolve(); return; }
    const done = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", done);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", done);
    setTimeout(resolve, 4000);
  });
}

function setCallStatus(text: string): void { const el = $("callStatus"); if (el) el.textContent = text; }
function attachRemote(): void {
  const v = $("callRemote") as HTMLVideoElement | null;
  if (!v || !call) return;
  v.srcObject = call.remote;
  v.play().catch(() => {});
}
function startCallClock(): void {
  if (!call) return;
  clearInterval(call.clock);
  const began = Date.now();
  call.clock = setInterval(() => {
    const s = Math.floor((Date.now() - began) / 1000);
    setCallStatus(Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"));
  }, 1000);
  setCallStatus("0:00");
}

function newCall(id: string, peerId: string, peerName: string, kind: string, role: string) {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  const c: any = { id, peerId, peerName, kind, role, pc, stream: null, remote: null, status: "setup", timer: null, clock: null };
  pc.ontrack = e => { c.remote = e.streams[0] || new MediaStream([e.track]); if (call === c) attachRemote(); };
  pc.onicecandidate = e => { if (e.candidate && call === c) sendTo(c.peerId, { type: "ice", callId: c.id, candidate: e.candidate.toJSON() }); };
  pc.onconnectionstatechange = () => {
    if (call !== c) return;
    if (pc.connectionState === "connected") { clearTimeout(c.timer); c.status = "connected"; startCallClock(); }
    else if (pc.connectionState === "failed") endCall("Could not connect. Some networks block direct calls.", true);
  };
  call = c;
  return c;
}

async function openMedia(c: any): Promise<void> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("this browser cannot use the microphone or camera");
  }
  c.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: c.kind === "video" ? { facingMode: "user" } : false });
  c.stream.getTracks().forEach((t: MediaStreamTrack) => c.pc.addTrack(t, c.stream));
  const loc = $("callLocal") as HTMLVideoElement | null;
  if (loc) loc.srcObject = c.stream;
}

function showCallScreen(c: any, status: string): void {
  const scr = $("callScreen");
  scr?.classList.remove("hidden");
  scr?.classList.toggle("audio", c.kind !== "video");
  const cn = $("callName");
  const cf = $("callFace");
  if (cn) cn.textContent = c.peerName || "Call";
  if (cf) cf.innerHTML = bigFace(profileOf(c.peerId));
  $("callLocal")?.classList.toggle("hidden", c.kind !== "video");
  $("callCamBtn")?.classList.toggle("hidden", c.kind !== "video");
  const mb = $("callMuteBtn");
  const cb = $("callCamBtn");
  if (mb) mb.textContent = "Mute";
  if (cb) cb.textContent = "Camera off";
  setCallStatus(status);
}

function failCall(err: any): void {
  const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
  toast(denied ? "Allow microphone and camera access, then try again." : "Call could not start: " + ((err && err.message) || err));
  if (call) endCall(null, true);
}

export function endCall(reason: string | null, notify: boolean): void {
  const c = call;
  if (!c) return;
  call = null;
  clearTimeout(c.timer);
  clearInterval(c.clock);
  if (notify) sendTo(c.peerId, { type: "end", callId: c.id });
  if (c.stream) c.stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
  c.pc.close();
  $("callScreen")?.classList.add("hidden");
  const rem = $("callRemote") as HTMLVideoElement | null;
  const loc = $("callLocal") as HTMLVideoElement | null;
  if (rem) rem.srcObject = null;
  if (loc) loc.srcObject = null;
  if (reason) toast(reason);
}

export function hideIncoming(): void {
  incoming = null;
  clearTimeout(incomingTimer);
  stopSettingSound();
  $("incomingCall")?.classList.add("hidden");
}

function showIncoming(msg: any): void {
  incoming = msg;
  const inName = $("incomingName");
  const inKind = $("incomingKind");
  const inFace = $("incomingFace");
  if (inName) inName.textContent = msg.fromName || "Someone";
  if (inKind) inKind.textContent = (msg.kind === "video" ? "Video" : "Audio") + " call";
  if (inFace) inFace.innerHTML = bigFace(profileOf(msg.from));
  $("incomingCall")?.classList.remove("hidden");
  playSettingSound(true);
  clearTimeout(incomingTimer);
  incomingTimer = setTimeout(() => { if (incoming) hideIncoming(); }, RING_MS);
}

async function onCallSignal(msg: any): Promise<void> {
  if (!msg || String(msg.to) !== String(state.userId)) return;
  const from = msg.from;
  if (msg.type === "invite") {
    if (call) { sendTo(from, { type: "busy", callId: msg.callId }); return; }
    if (incoming) return;
    showIncoming(msg);
    return;
  }
  if (msg.type === "busy") { endCall(profileName(from) + " is on another call.", false); return; }
  if (msg.type === "decline") { endCall(profileName(from) + " declined.", false); return; }
  if (msg.type === "end") {
    if (call && call.id === msg.callId) endCall("Call ended.", false);
    if (incoming && incoming.callId === msg.callId) hideIncoming();
    return;
  }
  if (msg.type === "answer") {
    if (!call || call.id !== msg.callId) return;
    try { await call.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp)); } catch (e) { failCall(e); }
    return;
  }
  if (msg.type === "ice") {
    if (!call || call.id !== msg.callId || !msg.candidate) return;
    try { await call.pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
  }
}

async function startCall(kind: string): Promise<void> {
  const t = state.threads.find(x => String(x.id) === String(state.activeThread));
  if (!t || t.kind !== "direct") { toast("Calls work in one-on-one chats"); return; }
  if (call || incoming) { toast("You are already in a call"); return; }
  const other = threadMembers(t).find(m => String(m.user_id) !== String(state.userId));
  if (!other) { toast("No one to call"); return; }
  if (!callChannel || callChannel.state !== "joined") { toast("Calls need a live connection. Wait for the live dot."); return; }
  if (!onlineIds().has(String(other.user_id))) { toast(profileName(other.user_id) + " is offline right now"); return; }
  const id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2);
  const c = newCall(id, other.user_id, profileName(other.user_id), kind, "caller");
  try {
    await openMedia(c);
    await c.pc.setLocalDescription(await c.pc.createOffer());
    await waitForIce(c.pc);
    c.status = "ringing";
    showCallScreen(c, "Ringing…");
    sendTo(other.user_id, {
      type: "invite",
      callId: id,
      kind,
      fromName: (state.profile && state.profile.full_name) || state.email || "Someone",
      sdp: plain(c.pc.localDescription),
    });
    c.timer = setTimeout(() => { if (call === c && c.status === "ringing") endCall("No answer", true); }, RING_MS);
  } catch (err) { failCall(err); }
}

async function acceptCall(): Promise<void> {
  if (!incoming) return;
  const msg = incoming;
  hideIncoming();
  const c = newCall(msg.callId, msg.from, profileName(msg.from), msg.kind || "audio", "callee");
  try {
    await openMedia(c);
    await c.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    await c.pc.setLocalDescription(await c.pc.createAnswer());
    await waitForIce(c.pc);
    c.status = "connected";
    showCallScreen(c, "Connecting…");
    sendTo(msg.from, { type: "answer", callId: c.id, sdp: plain(c.pc.localDescription) });
  } catch (err) { failCall(err); }
}

function declineCall(): void {
  if (incoming) {
    sendTo(incoming.from, { type: "decline", callId: incoming.callId });
    hideIncoming();
  }
}

/* ==================== CONTEXT MENU & CHAT WIRING ==================== */
let ctxMessageId: string | null = null;
let pendingDeleteMsgId: string | null = null;

function openMessageMenu(bub: HTMLElement, x: number, y: number): void {
  ctxMessageId = bub.dataset.messageId || null;
  const own = bub.dataset.ownMessage === "1";
  const isDeleted = bub.dataset.deleted === "1";
  $("ctxEditBtn")?.classList.toggle("hidden", !own || isDeleted);
  $("ctxDeleteBtn")?.classList.remove("hidden");
  document.querySelectorAll<HTMLElement>("#messageContextMenu [data-msg-act='copy'], #messageContextMenu [data-msg-act='reply'], #messageContextMenu [data-msg-act='pin']").forEach(btn => {
    btn.classList.toggle("hidden", isDeleted);
  });
  document.querySelector<HTMLElement>("#messageContextMenu .msg-reactions")?.classList.toggle("hidden", isDeleted);
  const menu = $("messageContextMenu");
  if (!menu) return;
  menu.classList.remove("hidden");
  const w = 176;
  const h = isDeleted ? 60 : 260;
  menu.style.left = Math.max(8, Math.min(x - w / 2, window.innerWidth - w - 8)) + "px";
  menu.style.top = Math.max(8, Math.min(y, window.innerHeight - h - 8)) + "px";
}
function closeMessageMenu(): void {
  $("messageContextMenu")?.classList.add("hidden");
  ctxMessageId = null;
}

export function closeDeleteMessageModal(): void {
  $("deleteMessageOverlay")?.classList.add("hidden");
  pendingDeleteMsgId = null;
}

export async function confirmDeleteForEveryone(): Promise<void> {
  const id = pendingDeleteMsgId;
  closeDeleteMessageModal();
  if (!id) return;
  const { error } = await runtime.client
    .from("messages")
    .update({
      deleted_at: new Date().toISOString(),
      body: "",
      attachment_url: null,
      attachment_name: null,
      attachment_type: null,
    })
    .eq("id", id);
  if (error) { toast("Could not delete for everyone: " + error.message); return; }
  if (String(runtime.editingMessageId) === String(id)) {
    runtime.editingMessageId = null;
    setVal("messageText", "");
    updateSendBtn();
  }
  if (runtime.replyingToMsg && String(runtime.replyingToMsg.id) === String(id)) cancelReply();
  await loadPreviews();
  if (state.activeThread) await loadMessages(state.activeThread);
  renderChatList();
  toast("Message deleted for everyone");
}

export async function confirmDeleteForYou(): Promise<void> {
  const id = pendingDeleteMsgId;
  closeDeleteMessageModal();
  if (!id) return;
  markDeletedForMe(id);
  if (String(runtime.editingMessageId) === String(id)) {
    runtime.editingMessageId = null;
    setVal("messageText", "");
    updateSendBtn();
  }
  if (runtime.replyingToMsg && String(runtime.replyingToMsg.id) === String(id)) cancelReply();
  await loadPreviews();
  renderMessages();
  renderChatList();
  toast("Message removed for you");
}

export function initChatWiring(): void {
  document.addEventListener("click", async e => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const previewImg = target.closest<HTMLElement>("[data-preview-url]");
    if (previewImg) {
      openPhotoPreview(
        previewImg.dataset.previewUrl || "",
        previewImg.dataset.previewLabel || "Photo",
        previewImg.dataset.previewDeleteId
      );
      return;
    }

    const callAct = target.closest<HTMLElement>("[data-act^='call-']");
    if (callAct) {
      const act = callAct.dataset.act;
      if (act === "call-start") startCall(callAct.dataset.id || "audio");
      else if (act === "call-accept") acceptCall();
      else if (act === "call-decline") declineCall();
      else if (act === "call-end") endCall(null, true);
      else if (act === "call-mute" && call) {
        const t = call.stream && call.stream.getAudioTracks()[0];
        if (t) { t.enabled = !t.enabled; callAct.textContent = t.enabled ? "Mute" : "Unmute"; }
      } else if (act === "call-cam" && call) {
        const t = call.stream && call.stream.getVideoTracks()[0];
        if (t) { t.enabled = !t.enabled; callAct.textContent = t.enabled ? "Camera off" : "Camera on"; }
      }
      return;
    }

    const bub = target.closest<HTMLElement>(".msgr-bub");
    if (bub && bub.dataset.messageId && !target.closest("a") && !target.closest(".msg-reaction-badge")) {
      if (String(bub.dataset.messageId).startsWith("temp-")) return;
      const r = bub.getBoundingClientRect();
      openMessageMenu(bub, r.left + r.width / 2, r.top + 4);
      return;
    }
    if (!target.closest("#messageContextMenu")) closeMessageMenu();
  });

  document.querySelectorAll<HTMLElement>("#messageContextMenu [data-react]").forEach(el => {
    el.addEventListener("click", async () => {
      if (!ctxMessageId) return;
      const { error } = await runtime.client.rpc("react_to_message", {
        p_message_id: Number(ctxMessageId),
        p_emoji: el.dataset.react,
      });
      closeMessageMenu();
      if (error) { toast("Could not react: " + error.message); return; }
      if (state.activeThread) await loadMessages(state.activeThread);
    });
  });

  document.querySelectorAll<HTMLElement>("#messageContextMenu [data-msg-act]").forEach(el => {
    el.addEventListener("click", async () => {
      const act = el.dataset.msgAct;
      const id = ctxMessageId;
      closeMessageMenu();
      if (!id) return;
      const msg = state.messages.find(m => String(m.id) === String(id));
      if (act === "copy") {
        navigator.clipboard.writeText(msg ? msg.body || "" : "").then(() => toast("Copied")).catch(() => {});
        return;
      }
      if (act === "reply" && msg) {
        runtime.replyingToMsg = msg;
        const rn = $("replyName");
        const rp = $("replyPreview");
        if (rn) rn.textContent = msg.sender_name || "Member";
        if (rp) rp.textContent = (msg.body || "").slice(0, 60);
        $("replyingIndicator")?.classList.remove("hidden");
        ($("messageText") as HTMLInputElement | null)?.focus();
        return;
      }
      if (act === "pin") {
        const { error } = await runtime.client.from("messages").update({ is_pinned: !(msg && msg.is_pinned) }).eq("id", id);
        if (error) { toast("Could not pin: " + error.message); return; }
        toast(msg && msg.is_pinned ? "Unpinned" : "Pinned");
        if (state.activeThread) await loadMessages(state.activeThread);
        return;
      }
      if (act === "edit" && msg) {
        runtime.editingMessageId = id;
        setVal("messageText", msg.body || "");
        ($("messageText") as HTMLInputElement | null)?.focus();
        updateSendBtn();
        return;
      }
      if (act === "delete") {
        pendingDeleteMsgId = id;
        const own = msg && String(msg.user_id) === String(state.userId);
        const canDeleteAll = !!(msg && !msg.deleted_at && (own || isManager()));
        $("deleteForEveryoneBtn")?.classList.toggle("hidden", !canDeleteAll);
        $("deleteMessageOverlay")?.classList.remove("hidden");
      }
    });
  });

  $("messageForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const text = val("messageText");
    if (runtime.editingMessageId) {
      if (!text.trim()) { toast("Message cannot be empty"); return; }
      const { error } = await runtime.client
        .from("messages")
        .update({ body: text.trim(), edited_at: new Date().toISOString() })
        .eq("id", runtime.editingMessageId);
      runtime.editingMessageId = null;
      setVal("messageText", "");
      updateSendBtn();
      if (error) { toast("Could not edit: " + error.message); return; }
      if (state.activeThread) await loadMessages(state.activeThread);
      return;
    }
    setVal("messageText", "");
    updateSendBtn();
    await sendMessage(text, null);
  });

  $("messageText")?.addEventListener("input", () => {
    updateSendBtn();
    if (typingChannel && state.activeThread && !typingSendTimeout) {
      typingChannel.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: state.userId, name: state.profile?.full_name || "Someone" },
      });
      typingSendTimeout = setTimeout(() => { typingSendTimeout = null; }, 1500);
    }
  });

  ["chatCam", "chatImage", "chatFile"].forEach(id => {
    const inp = $(id) as HTMLInputElement | null;
    inp?.addEventListener("change", async () => {
      const f = inp.files && inp.files[0];
      inp.value = "";
      if (!f) return;
      await sendMessage("", f);
    });
  });

  $("chatSearch")?.addEventListener("input", renderChatList);
  $("messageSearch")?.addEventListener("input", renderMessages);
}

/* ==================== CHAT MY DAY / STORIES & REELS ==================== */
let viewerStoriesList: any[] = [];
let viewerStoryIndex = 0;

export function openStoryComposer(): void {
  setVal("storyCaption", "");
  const fileEl = $("storyMediaFile") as HTMLInputElement | null;
  if (fileEl) fileEl.value = "";
  const st = $("storyComposerStatus");
  if (st) st.textContent = "Visible to all EESI members for 24 hours.";
  $("storyCreateOverlay")?.classList.remove("hidden");
}

export function closeStoryComposer(): void {
  $("storyCreateOverlay")?.classList.add("hidden");
}

export async function postStory(): Promise<void> {
  if (!checkNetwork() || !state.userId) return;
  const caption = val("storyCaption").trim();
  const bgStyle = val("storyBgStyle") || "linear-gradient(135deg,#0d254d,#1e6cf2)";
  const fileEl = $("storyMediaFile") as HTMLInputElement | null;
  const rawFile = fileEl?.files?.[0] || null;
  if (!caption && !rawFile) {
    toast("Add text, photo, or video reel for your My Day story.");
    return;
  }

  let initialMediaType: "image" | "video" | "text" = "text";
  if (rawFile) {
    const isVid = (rawFile.type || "").startsWith("video/") || isVideoUrl(rawFile.name);
    if (isVid) {
      if (rawFile.size > 45 * 1024 * 1024) { toast("Video reel max size is 45 MB."); return; }
      initialMediaType = "video";
    } else if (isImageFile(rawFile)) {
      initialMediaType = "image";
    } else {
      toast("Please select an image or video file.");
      return;
    }
  }

  const senderName = state.profile?.full_name || state.email || "Member";
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const localMediaUrl = rawFile ? URL.createObjectURL(rawFile) : null;
  const tempStoryId = "temp-story-" + Date.now();
  const tempStory: any = {
    id: tempStoryId,
    user_id: state.userId,
    sender_name: senderName,
    caption: caption || null,
    media_url: null,
    localMediaUrl,
    media_type: initialMediaType,
    bg_style: bgStyle,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
    isOptimistic: true,
  };

  if (fileEl) fileEl.value = "";
  setVal("storyCaption", "");
  state.stories = [tempStory, ...(state.stories || [])];
  renderChatList();
  closeStoryComposer();
  toast("⚡ My Day story sent!");
  suppressNotifications(5000);

  try {
    let mediaUrl: string | null = null;
    if (rawFile) {
      const uploadFile = initialMediaType === "image" ? await prepareImageFile(rawFile, 1440, 0.86) : rawFile;
      const path = `${state.userId}/stories/${Date.now()}-${uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await runtime.client.storage
        .from("chat")
        .upload(path, uploadFile, { upsert: false, contentType: uploadFile.type || undefined });
      if (upErr) throw upErr;
      const { data: pub } = runtime.client.storage.from("chat").getPublicUrl(path);
      mediaUrl = pub.publicUrl;
    }

    let savedViaFallback = runtime.storiesTableMissing;
    if (!savedViaFallback) {
      const { error } = await runtime.client.from("stories").insert({
        user_id: state.userId,
        sender_name: senderName,
        caption: caption || null,
        media_url: mediaUrl,
        media_type: initialMediaType,
        bg_style: bgStyle,
        expires_at: expiresAt,
      });
      if (error) {
        if (isMissingTableError(error)) {
          runtime.storiesTableMissing = true;
          savedViaFallback = true;
        } else {
          throw error;
        }
      }
    }

    if (savedViaFallback) {
      const body = buildStoryAppNoticeBody(caption || (initialMediaType === "video" ? "Shared a Reel" : "Shared a My Day photo"), {
        user_id: state.userId,
        sender_name: senderName,
        caption,
        media_url: mediaUrl,
        media_type: initialMediaType,
        bg_style: bgStyle,
        expires_at: expiresAt,
      });
      const { error: nErr } = await runtime.client.from("app_notifications").insert({
        title: `✨ ${senderName} posted a My Day Story`,
        body,
      });
      if (nErr) throw nErr;
      await loadAppNotifications();
    }

    state.stories = (state.stories || []).filter(s => String(s.id) !== tempStoryId);
    await loadStories();
    renderChatList();
  } catch (err: any) {
    state.stories = (state.stories || []).filter(s => String(s.id) !== tempStoryId);
    renderChatList();
    toast("Story upload failed: " + (err?.message || err));
  } finally {
    if (localMediaUrl) setTimeout(() => URL.revokeObjectURL(localMediaUrl), 1500);
  }
}

function renderStoryViewerSlide(): void {
  if (!viewerStoriesList.length) { closeStoryViewer(); return; }
  const s = viewerStoriesList[Math.max(0, Math.min(viewerStoryIndex, viewerStoriesList.length - 1))];
  if (!s) return;

  const p = profileOf(s.user_id);
  const av = $("storyViewerAvatar");
  const nm = $("storyViewerName");
  const tm = $("storyViewerTime");
  const mediaEl = $("storyViewerMedia");
  const capEl = $("storyViewerCaption");
  const dotsEl = $("storyViewerProgress");
  const delBtn = $("storyDeleteBtn");

  if (av) av.innerHTML = face(p);
  if (nm) nm.textContent = s.sender_name || p?.full_name || "Member";
  if (tm) tm.textContent = `${fmtDate(s.created_at)} (${viewerStoryIndex + 1}/${viewerStoriesList.length})`;
  if (dotsEl) {
    dotsEl.innerHTML = viewerStoriesList
      .map((_, i) => `<span style="flex:1;height:3px;border-radius:3px;background:${i <= viewerStoryIndex ? "#fff" : "rgba(255,255,255,.3)"};"></span>`)
      .join("");
  }
  if (delBtn) {
    const canDel = String(s.user_id) === String(state.userId) || isManager();
    delBtn.classList.toggle("hidden", !canDel);
    delBtn.setAttribute("data-story-id", String(s.id));
  }

  const u = safeUrl(s.media_url) || (s.localMediaUrl ? String(s.localMediaUrl) : null);
  if (mediaEl) {
    if (u && (s.media_type === "video" || isVideoUrl(u))) {
      mediaEl.innerHTML = `<video src="${esc(u)}" controls autoplay playsinline loop style="width:100%;max-height:62vh;border-radius:12px;background:#000;"></video>`;
    } else if (u) {
      mediaEl.innerHTML = `<img src="${esc(u)}" alt="Story" style="width:100%;max-height:62vh;object-fit:contain;border-radius:12px;background:#000;">`;
    } else {
      const bg = s.bg_style || "linear-gradient(135deg,#0d254d,#1e6cf2)";
      mediaEl.innerHTML =
        `<div style="min-height:260px;border-radius:14px;background:${esc(bg)};display:grid;place-items:center;padding:24px;text-align:center;font-size:22px;font-weight:800;color:#fff;line-height:1.35;">` +
        `${esc(s.caption || "My Day")}` +
        `</div>`;
    }
  }
  if (capEl) {
    const hasMedia = !!u;
    capEl.textContent = hasMedia && s.caption ? s.caption : "";
    capEl.classList.toggle("hidden", !(hasMedia && s.caption));
  }
}

export function openStoryViewer(userId: string): void {
  const nowMs = Date.now();
  const userStories = (state.stories || []).filter(
    s => String(s.user_id) === String(userId) && (!s.expires_at || new Date(s.expires_at).getTime() > nowMs)
  );
  if (!userStories.length) {
    toast("No active story for this member.");
    return;
  }
  viewerStoriesList = userStories.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  viewerStoryIndex = 0;
  $("storyViewerOverlay")?.classList.remove("hidden");
  renderStoryViewerSlide();
}

export function closeStoryViewer(): void {
  const mediaEl = $("storyViewerMedia");
  if (mediaEl) mediaEl.innerHTML = "";
  $("storyViewerOverlay")?.classList.add("hidden");
  viewerStoriesList = [];
}

export function stepStoryViewer(delta: number): void {
  const next = viewerStoryIndex + delta;
  if (next < 0) {
    viewerStoryIndex = 0;
  } else if (next >= viewerStoriesList.length) {
    closeStoryViewer();
    return;
  } else {
    viewerStoryIndex = next;
  }
  renderStoryViewerSlide();
}

export async function deleteStory(storyId?: string): Promise<void> {
  const btn = $("storyDeleteBtn");
  const id = storyId || btn?.getAttribute("data-story-id") || "";
  if (!id) return;
  if (!(await confirmDialog("Delete this My Day story?", "Delete story"))) return;
  try {
    if (String(id).startsWith("notice:")) {
      const nid = String(id).replace("notice:", "");
      const { error } = await runtime.client.from("app_notifications").delete().eq("id", nid);
      if (error) throw error;
      await loadAppNotifications();
    } else {
      const { error } = await runtime.client.from("stories").delete().eq("id", id);
      if (error) throw error;
    }
    viewerStoriesList = viewerStoriesList.filter(s => String(s.id) !== String(id));
    await loadStories();
    if (!viewerStoriesList.length) closeStoryViewer();
    else {
      viewerStoryIndex = Math.min(viewerStoryIndex, viewerStoriesList.length - 1);
      renderStoryViewerSlide();
    }
    toast("Story deleted");
  } catch (err: any) {
    toast("Could not delete story: " + (err?.message || err));
  }
}

