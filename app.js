// coroom - 메인 애플리케이션 로직
// 이 파일은 supabase-js(CDN), config.js, supabaseClient.js 이후에 로드됩니다.
(function () {
  "use strict";

  // ===================== 상수 =====================
  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const SLOT_WIDTH_PX = 60; // style.css의 --slot-width 값과 일치해야 함
  const DAY_START_HOUR = 9;
  const DAY_END_HOUR = 18;

  const ALL_TIMES = generateHalfHourTimes(DAY_START_HOUR, DAY_END_HOUR); // 09:00 ~ 18:00 (30분 단위)
  const SLOT_STARTS = ALL_TIMES.slice(0, -1); // 09:00 ~ 17:30 (실제 클릭 가능한 칸)

  // ===================== 상태 =====================
  const state = {
    user: null,
    rooms: [],
    reservationsForDate: [],
    currentDate: new Date(),
    activeTab: "dashboard",
    myReservations: [],
    realtimeChannel: null,
    pendingReservationContext: null,
  };

  let dashboardReady = false;
  let el = {};

  // ===================== 유틸 함수 =====================
  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function generateHalfHourTimes(startHour, endHour) {
    const times = [];
    for (let h = startHour; h <= endHour; h++) {
      times.push(`${pad2(h)}:00`);
      if (h !== endHour) times.push(`${pad2(h)}:30`);
    }
    return times;
  }

  function timeToMinutes(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  function minutesToTime(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${pad2(h)}:${pad2(m)}`;
  }

  function formatDateYMD(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function parseDateYMD(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDateLabel(d) {
    return `${formatDateYMD(d)} (${WEEKDAYS[d.getDay()]})`;
  }

  function genReservationCode(dateObj) {
    const year = dateObj.getFullYear();
    const seq = Math.floor(Math.random() * 900 + 100); // 100~999
    return `B${year}${seq}`;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function getReserverDisplayName() {
    if (!state.user) return "";
    return (state.user.user_metadata && state.user.user_metadata.full_name) || state.user.email || "";
  }

  // ===================== 초기화 =====================
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheDom();
    bindStaticEvents();
    buildStartOptions();

    if (!window.supabaseClient) {
      showAuthMessage("Supabase 클라이언트를 초기화하지 못했습니다. 설정을 확인해주세요.", "error");
      return;
    }

    supabaseClient.auth.onAuthStateChange(handleAuthStateChange);
  }

  function cacheDom() {
    el = {
      authSection: document.getElementById("authSection"),
      appSection: document.getElementById("appSection"),

      loginForm: document.getElementById("loginForm"),
      loginEmail: document.getElementById("loginEmail"),
      loginPassword: document.getElementById("loginPassword"),

      signupForm: document.getElementById("signupForm"),
      signupName: document.getElementById("signupName"),
      signupEmail: document.getElementById("signupEmail"),
      signupPassword: document.getElementById("signupPassword"),

      authMessage: document.getElementById("authMessage"),

      prevDayBtn: document.getElementById("prevDayBtn"),
      nextDayBtn: document.getElementById("nextDayBtn"),
      todayBtn: document.getElementById("todayBtn"),
      datePicker: document.getElementById("datePicker"),
      dateLabel: document.getElementById("dateLabel"),

      userLabel: document.getElementById("userLabel"),
      logoutBtn: document.getElementById("logoutBtn"),

      dashboardView: document.getElementById("dashboardView"),
      myReservationsView: document.getElementById("myReservationsView"),
      loadingIndicator: document.getElementById("loadingIndicator"),
      grid: document.getElementById("grid"),

      myReservationsBody: document.getElementById("myReservationsBody"),
      myReservationsEmpty: document.getElementById("myReservationsEmpty"),

      reservationModalOverlay: document.getElementById("reservationModalOverlay"),
      reservationForm: document.getElementById("reservationForm"),
      resRoomName: document.getElementById("resRoomName"),
      resDate: document.getElementById("resDate"),
      resStartTime: document.getElementById("resStartTime"),
      resEndTime: document.getElementById("resEndTime"),
      resTitle: document.getElementById("resTitle"),
      resDepartment: document.getElementById("resDepartment"),
      resReserverName: document.getElementById("resReserverName"),
      reservationFormError: document.getElementById("reservationFormError"),
      reservationCancelBtn: document.getElementById("reservationCancelBtn"),
      reservationSubmitBtn: document.getElementById("reservationSubmitBtn"),

      detailModalOverlay: document.getElementById("detailModalOverlay"),
      detailRoomName: document.getElementById("detailRoomName"),
      detailTitle: document.getElementById("detailTitle"),
      detailReserver: document.getElementById("detailReserver"),
      detailDepartment: document.getElementById("detailDepartment"),
      detailDate: document.getElementById("detailDate"),
      detailTime: document.getElementById("detailTime"),
      detailStatus: document.getElementById("detailStatus"),
      detailError: document.getElementById("detailError"),
      detailCloseBtn: document.getElementById("detailCloseBtn"),
      detailCancelReservationBtn: document.getElementById("detailCancelReservationBtn"),

      toastContainer: document.getElementById("toastContainer"),
    };
  }

  function bindStaticEvents() {
    document.querySelectorAll(".auth-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchAuthTab(btn.dataset.authTab));
    });

    el.loginForm.addEventListener("submit", handleLoginSubmit);
    el.signupForm.addEventListener("submit", handleSignupSubmit);
    el.logoutBtn.addEventListener("click", handleLogout);

    el.prevDayBtn.addEventListener("click", () => changeDate(-1));
    el.nextDayBtn.addEventListener("click", () => changeDate(1));
    el.todayBtn.addEventListener("click", () => setDate(new Date()));
    el.datePicker.addEventListener("change", (e) => {
      if (e.target.value) setDate(parseDateYMD(e.target.value));
    });

    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    el.resStartTime.addEventListener("change", () => buildEndOptions(el.resStartTime.value));
    el.reservationForm.addEventListener("submit", handleReservationSubmit);
    el.reservationCancelBtn.addEventListener("click", () => hideModal(el.reservationModalOverlay));
    el.reservationModalOverlay.addEventListener("click", (e) => {
      if (e.target === el.reservationModalOverlay) hideModal(el.reservationModalOverlay);
    });

    el.detailCloseBtn.addEventListener("click", () => hideModal(el.detailModalOverlay));
    el.detailModalOverlay.addEventListener("click", (e) => {
      if (e.target === el.detailModalOverlay) hideModal(el.detailModalOverlay);
    });
  }

  // ===================== 인증 =====================
  function handleAuthStateChange(_event, session) {
    state.user = (session && session.user) || null;
    renderAuthState();

    if (state.user && !dashboardReady) {
      dashboardReady = true;
      onLoggedIn();
    } else if (!state.user && dashboardReady) {
      dashboardReady = false;
      onLoggedOut();
    }
  }

  function renderAuthState() {
    if (state.user) {
      el.authSection.classList.add("hidden");
      el.appSection.classList.remove("hidden");
      el.userLabel.textContent = getReserverDisplayName();
    } else {
      el.authSection.classList.remove("hidden");
      el.appSection.classList.add("hidden");
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    hideAuthMessage();
    const email = el.loginEmail.value.trim();
    const password = el.loginPassword.value;
    setFormDisabled(el.loginForm, true);
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    setFormDisabled(el.loginForm, false);
    if (error) {
      showAuthMessage(translateAuthError(error), "error");
    }
  }

  async function handleSignupSubmit(e) {
    e.preventDefault();
    hideAuthMessage();
    const name = el.signupName.value.trim();
    const email = el.signupEmail.value.trim();
    const password = el.signupPassword.value;
    setFormDisabled(el.signupForm, true);
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    setFormDisabled(el.signupForm, false);
    if (error) {
      showAuthMessage(translateAuthError(error), "error");
      return;
    }
    if (data && data.session) {
      showAuthMessage("회원가입이 완료되었습니다.", "success");
    } else {
      showAuthMessage("회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.", "success");
      switchAuthTab("login");
    }
  }

  async function handleLogout() {
    await supabaseClient.auth.signOut();
  }

  function switchAuthTab(tab) {
    document.querySelectorAll(".auth-tab-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.authTab === tab);
    });
    el.loginForm.classList.toggle("hidden", tab !== "login");
    el.signupForm.classList.toggle("hidden", tab !== "signup");
    hideAuthMessage();
  }

  function showAuthMessage(msg, type) {
    el.authMessage.textContent = msg;
    el.authMessage.className = "auth-message " + type;
    el.authMessage.classList.remove("hidden");
  }

  function hideAuthMessage() {
    el.authMessage.classList.add("hidden");
  }

  function translateAuthError(error) {
    const msg = (error && error.message) || "알 수 없는 오류가 발생했습니다.";
    if (msg.includes("Invalid login credentials")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
    if (msg.includes("already registered") || msg.includes("already exists")) return "이미 가입된 이메일입니다.";
    if (msg.toLowerCase().includes("password")) return "비밀번호는 6자 이상이어야 합니다.";
    if (msg.includes("valid email")) return "올바른 이메일 형식이 아닙니다.";
    return msg;
  }

  function setFormDisabled(form, disabled) {
    Array.from(form.elements).forEach((elm) => (elm.disabled = disabled));
  }

  // ===================== 로그인 이후 초기화 =====================
  async function onLoggedIn() {
    await loadRooms();
    setDate(new Date());
    subscribeRealtime();
    switchTab("dashboard");
  }

  function onLoggedOut() {
    unsubscribeRealtime();
    state.rooms = [];
    state.reservationsForDate = [];
    state.myReservations = [];
    el.grid.innerHTML = "";
    el.myReservationsBody.innerHTML = "";
  }

  async function loadRooms() {
    const { data, error } = await supabaseClient.from("rooms").select("*").order("id");
    if (error) {
      toast("회의실 정보를 불러오지 못했습니다: " + error.message, "error");
      return;
    }
    state.rooms = data || [];
  }

  // ===================== 탭 전환 =====================
  function switchTab(tab) {
    state.activeTab = tab;
    el.dashboardView.classList.toggle("hidden", tab !== "dashboard");
    el.myReservationsView.classList.toggle("hidden", tab !== "my");
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    if (tab === "my") refreshMyReservations();
  }

  // ===================== 날짜 이동 =====================
  function changeDate(deltaDays) {
    const d = new Date(state.currentDate);
    d.setDate(d.getDate() + deltaDays);
    setDate(d);
  }

  function setDate(date) {
    state.currentDate = date;
    el.datePicker.value = formatDateYMD(date);
    el.dateLabel.textContent = formatDateLabel(date);
    refreshDashboard();
  }

  // ===================== 대시보드 / 그리드 =====================
  async function fetchReservationsForDate(dateStr) {
    const { data, error } = await supabaseClient
      .from("reservations")
      .select("*")
      .eq("reservation_date", dateStr)
      .eq("status", "confirmed");
    if (error) {
      toast("예약 정보를 불러오지 못했습니다: " + error.message, "error");
      return [];
    }
    return data || [];
  }

  async function refreshDashboard() {
    if (!state.rooms.length) return;
    showLoading(true);
    const dateStr = formatDateYMD(state.currentDate);
    state.reservationsForDate = await fetchReservationsForDate(dateStr);
    renderGrid();
    showLoading(false);
  }

  function showLoading(flag) {
    el.loadingIndicator.classList.toggle("hidden", !flag);
  }

  function renderGrid() {
    const grid = el.grid;
    grid.innerHTML = "";

    // 헤더
    const headerRow = document.createElement("div");
    headerRow.className = "grid-header-row";

    const corner = document.createElement("div");
    corner.className = "grid-header-corner";
    corner.textContent = "회의실";
    headerRow.appendChild(corner);

    const headerSlots = document.createElement("div");
    headerSlots.className = "grid-header-slots";
    for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
      const label = document.createElement("div");
      label.className = "hour-label";
      label.textContent = `${pad2(h)}:00`;
      headerSlots.appendChild(label);
    }
    headerRow.appendChild(headerSlots);
    grid.appendChild(headerRow);

    // 회의실별 행
    state.rooms.forEach((room) => {
      const row = document.createElement("div");
      row.className = "room-row";

      const info = document.createElement("div");
      info.className = "room-info";

      const nameLine = document.createElement("div");
      nameLine.className = "room-name-line";
      nameLine.innerHTML = `<span>${escapeHtml(room.name)}</span><span class="capacity-badge">${room.capacity}인</span>`;
      info.appendChild(nameLine);

      const meta = document.createElement("div");
      meta.className = "room-meta";
      const equipmentStr = (room.equipment || []).join(", ");
      meta.title = `${room.floor} · ${equipmentStr}${room.note ? " · " + room.note : ""}`;
      meta.textContent = `${room.floor} · ${equipmentStr}`;
      info.appendChild(meta);

      if (room.note) {
        const note = document.createElement("div");
        note.className = "room-note";
        note.textContent = room.note;
        info.appendChild(note);
      }

      row.appendChild(info);

      const slotsRow = document.createElement("div");
      slotsRow.className = "slots-row";

      SLOT_STARTS.forEach((slotTime, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "slot-btn" + (idx % 2 === 0 ? " hour-start" : "");
        btn.title = `${room.name} · ${slotTime} 예약하기`;
        btn.addEventListener("click", () => handleSlotClick(room, slotTime));
        slotsRow.appendChild(btn);
      });

      const roomReservations = state.reservationsForDate.filter((r) => r.room_id === room.id);
      roomReservations.forEach((r) => {
        const startTime = r.start_time.slice(0, 5);
        const endTime = r.end_time.slice(0, 5);
        const startIdx = SLOT_STARTS.indexOf(startTime);
        if (startIdx === -1) return;
        const numSlots = (timeToMinutes(endTime) - timeToMinutes(startTime)) / 30;

        const block = document.createElement("div");
        block.className = "reservation-block room-color-" + room.id;
        block.style.left = startIdx * SLOT_WIDTH_PX + "px";
        block.style.width = Math.max(numSlots * SLOT_WIDTH_PX - 4, 24) + "px";
        block.innerHTML =
          `<span class="r-title">${escapeHtml(r.title)}</span>` +
          `<span class="r-reserver">${escapeHtml(r.reserver_name)}</span>`;
        block.addEventListener("click", (e) => {
          e.stopPropagation();
          handleReservationBlockClick(r, room);
        });
        slotsRow.appendChild(block);
      });

      row.appendChild(slotsRow);
      grid.appendChild(row);
    });
  }

  // ===================== 예약 생성 모달 =====================
  function buildStartOptions() {
    el.resStartTime.innerHTML = SLOT_STARTS.map((t) => `<option value="${t}">${t}</option>`).join("");
  }

  function buildEndOptions(selectedStart) {
    const startIdx = SLOT_STARTS.indexOf(selectedStart);
    const possibleEnds = ALL_TIMES.slice(startIdx + 1);
    el.resEndTime.innerHTML = possibleEnds.map((t) => `<option value="${t}">${t}</option>`).join("");
    const defaultEndMinutes = Math.min(timeToMinutes(selectedStart) + 60, timeToMinutes(ALL_TIMES[ALL_TIMES.length - 1]));
    el.resEndTime.value = minutesToTime(defaultEndMinutes);
  }

  function handleSlotClick(room, startTime) {
    if (!state.user) return;
    state.pendingReservationContext = { room };
    el.resRoomName.value = room.name;
    el.resDate.value = formatDateYMD(state.currentDate);
    buildStartOptions();
    el.resStartTime.value = startTime;
    buildEndOptions(startTime);
    el.resTitle.value = "";
    el.resDepartment.value = "";
    el.resReserverName.value = getReserverDisplayName();
    hideFormError();
    showModal(el.reservationModalOverlay);
  }

  async function handleReservationSubmit(e) {
    e.preventDefault();
    hideFormError();

    const context = state.pendingReservationContext;
    if (!context) return;
    const room = context.room;
    const dateStr = el.resDate.value;
    const startTime = el.resStartTime.value;
    const endTime = el.resEndTime.value;
    const title = el.resTitle.value.trim();
    const department = el.resDepartment.value.trim();

    if (!title || !department) {
      showFormError("회의 제목과 부서를 입력해주세요.");
      return;
    }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      showFormError("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }

    setFormDisabled(el.reservationForm, true);
    const dateObj = parseDateYMD(dateStr);
    let lastError = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      const code = genReservationCode(dateObj);
      const { error } = await supabaseClient.from("reservations").insert({
        reservation_code: code,
        room_id: room.id,
        user_id: state.user.id,
        reserver_name: getReserverDisplayName(),
        department,
        title,
        reservation_date: dateStr,
        start_time: startTime,
        end_time: endTime,
      });
      if (!error) {
        lastError = null;
        break;
      }
      lastError = error;
      if (error.code === "23505" && attempt === 0) continue; // 예약번호 충돌 시 1회 재시도
      break;
    }

    setFormDisabled(el.reservationForm, false);

    if (lastError) {
      if (lastError.code === "23P01") {
        showFormError("이미 예약된 시간입니다. 다른 시간을 선택해주세요.");
      } else if (lastError.code === "23505") {
        showFormError("예약번호 생성이 겹쳤습니다. 다시 시도해주세요.");
      } else {
        showFormError("예약에 실패했습니다: " + lastError.message);
      }
      return;
    }

    hideModal(el.reservationModalOverlay);
    toast("예약이 완료되었습니다.", "success");
    await refreshDashboard();
    if (state.activeTab === "my") await refreshMyReservations();
  }

  function showFormError(msg) {
    el.reservationFormError.textContent = msg;
    el.reservationFormError.classList.remove("hidden");
  }

  function hideFormError() {
    el.reservationFormError.classList.add("hidden");
  }

  // ===================== 예약 상세 모달 =====================
  function handleReservationBlockClick(reservation, room) {
    el.detailRoomName.textContent = room.name;
    el.detailTitle.textContent = reservation.title;
    el.detailReserver.textContent = reservation.reserver_name;
    el.detailDepartment.textContent = reservation.department;
    el.detailDate.textContent = reservation.reservation_date;
    el.detailTime.textContent = `${reservation.start_time.slice(0, 5)} - ${reservation.end_time.slice(0, 5)}`;
    el.detailStatus.textContent = reservation.status === "confirmed" ? "확정" : "취소됨";
    hideDetailError();

    const isOwner = !!(state.user && reservation.user_id === state.user.id);
    const canCancel = isOwner && reservation.status === "confirmed";
    el.detailCancelReservationBtn.classList.toggle("hidden", !canCancel);
    el.detailCancelReservationBtn.onclick = () => cancelReservationFromDetail(reservation.id);

    showModal(el.detailModalOverlay);
  }

  async function cancelReservationFromDetail(id) {
    if (!window.confirm("이 예약을 취소하시겠습니까?")) return;
    const { error } = await supabaseClient
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("user_id", state.user.id);
    if (error) {
      showDetailError("취소에 실패했습니다: " + error.message);
      return;
    }
    hideModal(el.detailModalOverlay);
    toast("예약이 취소되었습니다.", "success");
    await refreshDashboard();
    if (state.activeTab === "my") await refreshMyReservations();
  }

  function showDetailError(msg) {
    el.detailError.textContent = msg;
    el.detailError.classList.remove("hidden");
  }

  function hideDetailError() {
    el.detailError.classList.add("hidden");
  }

  // ===================== 내 예약 =====================
  async function refreshMyReservations() {
    if (!state.user) return;
    const { data, error } = await supabaseClient
      .from("reservations")
      .select("*, rooms(name)")
      .eq("user_id", state.user.id)
      .order("reservation_date", { ascending: false })
      .order("start_time", { ascending: false });
    if (error) {
      toast("내 예약을 불러오지 못했습니다: " + error.message, "error");
      return;
    }
    state.myReservations = data || [];
    renderMyReservations();
  }

  function renderMyReservations() {
    const body = el.myReservationsBody;
    body.innerHTML = "";

    el.myReservationsEmpty.classList.toggle("hidden", state.myReservations.length !== 0);

    state.myReservations.forEach((r) => {
      const tr = document.createElement("tr");
      const statusClass = r.status === "confirmed" ? "status-confirmed" : "status-cancelled";
      const statusText = r.status === "confirmed" ? "확정" : "취소";
      const roomName = (r.rooms && r.rooms.name) || "-";

      tr.innerHTML = `
        <td>${escapeHtml(r.reservation_code)}</td>
        <td>${escapeHtml(roomName)}</td>
        <td>${escapeHtml(r.reservation_date)}</td>
        <td>${r.start_time.slice(0, 5)} - ${r.end_time.slice(0, 5)}</td>
        <td>${escapeHtml(r.title)}</td>
        <td>${escapeHtml(r.department)}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td></td>
      `;

      if (r.status === "confirmed") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-danger";
        btn.textContent = "취소";
        btn.addEventListener("click", () => cancelMyReservation(r.id));
        tr.lastElementChild.appendChild(btn);
      }

      body.appendChild(tr);
    });
  }

  async function cancelMyReservation(id) {
    if (!window.confirm("이 예약을 취소하시겠습니까?")) return;
    const { error } = await supabaseClient
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("user_id", state.user.id);
    if (error) {
      toast("취소에 실패했습니다: " + error.message, "error");
      return;
    }
    toast("예약이 취소되었습니다.", "success");
    await refreshMyReservations();
    await refreshDashboard();
  }

  // ===================== 실시간 동기화 =====================
  function subscribeRealtime() {
    if (state.realtimeChannel) return;
    state.realtimeChannel = supabaseClient
      .channel("reservations-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations" },
        () => {
          refreshDashboard();
          if (state.activeTab === "my") refreshMyReservations();
        }
      )
      .subscribe();
  }

  function unsubscribeRealtime() {
    if (state.realtimeChannel) {
      supabaseClient.removeChannel(state.realtimeChannel);
      state.realtimeChannel = null;
    }
  }

  // ===================== 모달 공통 =====================
  function showModal(overlay) {
    overlay.classList.remove("hidden");
  }

  function hideModal(overlay) {
    overlay.classList.add("hidden");
  }

  // ===================== 토스트 =====================
  function toast(message, type) {
    const div = document.createElement("div");
    div.className = "toast toast-" + (type || "info");
    div.textContent = message;
    el.toastContainer.appendChild(div);
    setTimeout(() => div.remove(), 3500);
  }
})();
