window.HelpdeskData = {
  departments: [
    "การเงิน",
    "การตลาด",
    "ขาย",
    "คลังสินค้า",
    "จป. วิชาชีพ",
    "จัดซื้อ",
    "นักลงทุนสัมพันธ์",
    "บริหารทั่วไป",
    "บุคคล",
    "บัญชี",
    "ผู้ป่วยนอก",
    "พัฒนาธุรกิจ",
    "เภสัช",
    "เวชระเบียน",
    "สกิน",
    "ห้องผ่าตัด",
    "อาคารสถานที่",
    "แอดมิน"
  ],
  categories: [
    "อุปกรณ์คอมพิวเตอร์และอุปกรณ์ต่อพ่วง",
    "ซอฟต์แวร์และโปรแกรมประยุกต์",
    "ระบบเครือข่ายและอินเทอร์เน็ต",
    "บัญชีผู้ใช้งานและสิทธิ์การเข้าถึง",
    "ระบบสารสนเทศโรงพยาบาล HIS",
    "อื่นๆ"
  ],
  priorities: ["ต่ำ", "ปานกลาง", "สูง", "เร่งด่วน"],
  statuses: ["รอรับเรื่อง", "กำลังดำเนินการ", "เสร็จสิ้น", "ยกเลิก"],
  tickets: [
    {
      id: 1,
      ticketNo: "REQ-690001",
      requesterName: "วชิรวิทย์ คงดี",
      department: "บัญชี",
      category: "อุปกรณ์คอมพิวเตอร์และอุปกรณ์ต่อพ่วง",
      priority: "สูง",
      status: "รอรับเรื่อง",
      assignee: "",
      title: "เครื่องพิมพ์แผนกบัญชีพิมพ์ไม่ออก",
      description: "เครื่องพิมพ์ขึ้นสถานะ offline แม้เปิดเครื่องแล้ว ต้องการให้ตรวจสอบด่วน",
      solution: "",
      attachmentName: "printer-error.jpg",
      createdAt: "2026-08-17T09:20:00+07:00",
      updatedAt: "2026-08-17T09:20:00+07:00",
      completedAt: "",
      cancelledAt: ""
    },
    {
      id: 2,
      ticketNo: "REQ-690002",
      requesterName: "สุภาวดี แสงทอง",
      department: "แอดมิน",
      category: "บัญชีผู้ใช้งานและสิทธิ์การเข้าถึง",
      priority: "ปานกลาง",
      status: "กำลังดำเนินการ",
      assignee: "ผู้ดูแลระบบ",
      title: "เข้าใช้งานระบบ HR ไม่ได้",
      description: "ระบบแจ้งว่ารหัสผ่านไม่ถูกต้อง หลังจากเปลี่ยนรหัสผ่านเมื่อเช้า",
      solution: "",
      attachmentName: "",
      createdAt: "2026-08-17T10:05:00+07:00",
      updatedAt: "2026-08-17T10:40:00+07:00",
      completedAt: "",
      cancelledAt: ""
    }
  ]
};

window.HelpdeskStore = {
  key: "helpdesksystem.local.tickets",
  settingsKey: "helpdesksystem.local.settings",
  getSavedTickets() {
    const tickets = JSON.parse(localStorage.getItem(this.key) || "[]");
    const migrated = this.repairUserTicketSequence(this.migrateTicketNumbers(tickets));
    if (JSON.stringify(migrated) !== JSON.stringify(tickets)) {
      this.saveTickets(migrated);
    }
    return migrated;
  },
  saveTickets(tickets) {
    localStorage.setItem(this.key, JSON.stringify(tickets));
  },
  getSettings() {
    return JSON.parse(localStorage.getItem(this.settingsKey) || "{}") || {};
  },
  saveSettings(settings) {
    localStorage.setItem(this.settingsKey, JSON.stringify(settings));
  },
  getBaseTicketsForNumbers() {
    return this.getSettings().dataCleared ? [] : window.HelpdeskData.tickets;
  },
  getBuddhistYearCode(dateValue) {
    const year = new Date(dateValue || Date.now()).getFullYear() + 543;
    return String(year).slice(-2);
  },
  isNewTicketNo(ticketNo) {
    return /^REQ-\d{6}$/.test(ticketNo || "");
  },
  makeTicketNoForSequence(dateValue, sequence) {
    return `REQ-${this.getBuddhistYearCode(dateValue)}${String(sequence).padStart(4, "0")}`;
  },
  getMaxSequenceFromTickets(tickets, yearCode) {
    return tickets.reduce((max, ticket) => {
      const ticketNo = String(ticket.ticketNo || "");
      if (!ticketNo.startsWith(`REQ-${yearCode}`)) return max;
      const seq = Number(ticketNo.slice(6));
      return Number.isFinite(seq) ? Math.max(max, seq) : max;
    }, 0);
  },
  getMaxSequenceForYear(yearCode) {
    return this.getMaxSequenceFromTickets([...this.getBaseTicketsForNumbers(), ...this.getSavedTickets()], yearCode);
  },
  normalizeTicketNo(ticketNo) {
    return String(ticketNo || "").trim().toUpperCase();
  },
  setNextTicketNo(ticketNo) {
    const nextTicketNo = this.normalizeTicketNo(ticketNo);
    if (!this.isNewTicketNo(nextTicketNo)) return false;
    this.saveSettings({ ...this.getSettings(), nextTicketNo });
    this.syncNextTicketNoWithTickets(this.getSavedTickets());
    return true;
  },
  getNextTicketNo() {
    const settings = this.getSettings();
    return this.isNewTicketNo(settings.nextTicketNo) ? settings.nextTicketNo : this.makeTicketNo();
  },
  syncNextTicketNoWithTickets(tickets) {
    const settings = this.getSettings();
    if (!this.isNewTicketNo(settings.nextTicketNo)) return;
    const yearCode = settings.nextTicketNo.slice(4, 6);
    const currentSeq = Number(settings.nextTicketNo.slice(6));
    const maxSeq = this.getMaxSequenceFromTickets([...this.getBaseTicketsForNumbers(), ...tickets], yearCode);
    if (Number.isFinite(currentSeq) && maxSeq >= currentSeq) {
      this.saveSettings({ ...settings, nextTicketNo: `REQ-${yearCode}${String(maxSeq + 1).padStart(4, "0")}` });
    }
  },
  clearTickets(nextTicketNo) {
    const normalizedTicketNo = this.normalizeTicketNo(nextTicketNo);
    if (normalizedTicketNo && !this.isNewTicketNo(normalizedTicketNo)) return false;
    this.saveTickets([]);
    this.saveSettings({ ...this.getSettings(), dataCleared: true, nextTicketNo: normalizedTicketNo || "" });
    return true;
  },
  migrateTicketNumbers(tickets) {
    const countersByYear = {};
    return tickets
      .slice()
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      .map((ticket) => {
        if (this.isNewTicketNo(ticket.ticketNo)) {
          const yearCode = ticket.ticketNo.slice(4, 6);
          const seq = Number(ticket.ticketNo.slice(6));
          countersByYear[yearCode] = Math.max(countersByYear[yearCode] || 0, Number.isFinite(seq) ? seq : 0);
          return ticket;
        }
        const yearCode = this.getBuddhistYearCode(ticket.createdAt);
        countersByYear[yearCode] = (countersByYear[yearCode] || 0) + 1;
        return {
          ...ticket,
          oldTicketNo: ticket.oldTicketNo || ticket.ticketNo,
          ticketNo: this.makeTicketNoForSequence(ticket.createdAt, countersByYear[yearCode])
        };
      });
  },
  repairUserTicketSequence(tickets) {
    const maxSeqByYear = {};

    [...window.HelpdeskData.tickets, ...tickets.filter((ticket) => ticket.source !== "user")].forEach((ticket) => {
      if (!this.isNewTicketNo(ticket.ticketNo)) return;
      const yearCode = ticket.ticketNo.slice(4, 6);
      const seq = Number(ticket.ticketNo.slice(6));
      maxSeqByYear[yearCode] = Math.max(maxSeqByYear[yearCode] || 0, Number.isFinite(seq) ? seq : 0);
    });

    return tickets
      .slice()
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      .map((ticket) => {
        if (ticket.source !== "user") return ticket;

        const yearCode = this.isNewTicketNo(ticket.ticketNo) ? ticket.ticketNo.slice(4, 6) : this.getBuddhistYearCode(ticket.createdAt);
        const currentSeq = this.isNewTicketNo(ticket.ticketNo) ? Number(ticket.ticketNo.slice(6)) : 0;
        const maxSeq = maxSeqByYear[yearCode] || 0;

        if (Number.isFinite(currentSeq) && currentSeq > maxSeq) {
          maxSeqByYear[yearCode] = currentSeq;
          return ticket;
        }

        maxSeqByYear[yearCode] = maxSeq + 1;
        return {
          ...ticket,
          oldTicketNo: ticket.oldTicketNo || ticket.ticketNo,
          ticketNo: this.makeTicketNoForSequence(ticket.createdAt, maxSeqByYear[yearCode])
        };
      });
  },
  getSampleTicketNos() {
    return new Set(window.HelpdeskData.tickets.map((ticket) => ticket.ticketNo));
  },
  getUserTickets() {
    const sampleTicketNos = this.getSampleTicketNos();
    return this.getSavedTickets().filter(
      (ticket) => ticket.source === "user" || ticket.source === "import" || !sampleTicketNos.has(ticket.ticketNo)
    );
  },
  getTickets() {
    const saved = this.getSavedTickets();
    const userTickets = this.getUserTickets();

    if (userTickets.length > 0 || this.getSettings().dataCleared) {
      return userTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const byTicketNo = new Map();
    this.getBaseTicketsForNumbers().forEach((ticket) => byTicketNo.set(ticket.ticketNo, ticket));
    saved.forEach((ticket) => byTicketNo.set(ticket.ticketNo, ticket));
    return Array.from(byTicketNo.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  addTicket(ticket) {
    const saved = this.getSavedTickets();
    const nextTicket = { ...ticket, source: ticket.source || "user" };
    const existingIndex = saved.findIndex((item) => item.ticketNo === nextTicket.ticketNo);

    if (nextTicket.source === "server" && existingIndex >= 0) {
      saved[existingIndex] = { ...saved[existingIndex], ...nextTicket };
      this.saveTickets(saved);
      this.syncNextTicketNoWithTickets(saved);
      return saved[existingIndex];
    }

    const yearCode = this.getBuddhistYearCode(nextTicket.createdAt || Date.now());
    const maxSeq = [...this.getBaseTicketsForNumbers(), ...saved].reduce((max, item) => {
      const ticketNo = String(item.ticketNo || "");
      if (!ticketNo.startsWith(`REQ-${yearCode}`)) return max;
      const seq = Number(ticketNo.slice(6));
      return Number.isFinite(seq) ? Math.max(max, seq) : max;
    }, 0);
    const currentSeq = this.isNewTicketNo(nextTicket.ticketNo) && nextTicket.ticketNo.startsWith(`REQ-${yearCode}`)
      ? Number(nextTicket.ticketNo.slice(6))
      : 0;
    const shouldAdjustTicketNo = nextTicket.source !== "server" && (existingIndex >= 0 || !Number.isFinite(currentSeq) || currentSeq <= maxSeq);

    if (shouldAdjustTicketNo) {
      nextTicket.oldTicketNo = nextTicket.oldTicketNo || nextTicket.ticketNo;
      nextTicket.ticketNo = this.makeTicketNoForSequence(nextTicket.createdAt || Date.now(), maxSeq + 1);
    }

    saved.push(nextTicket);
    this.saveTickets(saved);
    this.syncNextTicketNoWithTickets(saved);
    return nextTicket;
  },
  importTickets(tickets) {
    const saved = this.getSavedTickets();
    let inserted = 0;
    let updated = 0;

    tickets.forEach((ticket) => {
      const nextTicket = { ...ticket, source: ticket.source || "import" };
      const existingIndex = saved.findIndex((item) => item.ticketNo === nextTicket.ticketNo);
      if (existingIndex >= 0) {
        saved[existingIndex] = { ...saved[existingIndex], ...nextTicket };
        updated += 1;
      } else {
        saved.push(nextTicket);
        inserted += 1;
      }
    });

    this.saveTickets(saved);
    this.saveSettings({ ...this.getSettings(), dataCleared: true });
    this.syncNextTicketNoWithTickets(saved);
    return { total: tickets.length, inserted, updated };
  },
  updateStatus(ticketNo, status) {
    const saved = this.getSavedTickets();
    let ticket = saved.find((item) => item.ticketNo === ticketNo);
    if (!ticket) {
      const baseTicket = window.HelpdeskData.tickets.find((item) => item.ticketNo === ticketNo);
      if (baseTicket) {
        ticket = { ...baseTicket };
        saved.push(ticket);
      }
    }
    if (ticket) {
      const now = new Date().toISOString();
      ticket.status = status;
      ticket.updatedAt = now;
      if (status === "เสร็จสิ้น") {
        ticket.completedAt = ticket.completedAt || now;
        ticket.cancelledAt = "";
      } else if (status === "ยกเลิก") {
        ticket.cancelledAt = ticket.cancelledAt || now;
        ticket.completedAt = "";
      } else {
        ticket.completedAt = "";
        ticket.cancelledAt = "";
      }
      this.saveTickets(saved);
    }
  },
  updateCategory(ticketNo, category) {
    const saved = this.getSavedTickets();
    let ticket = saved.find((item) => item.ticketNo === ticketNo);
    if (!ticket) {
      const baseTicket = window.HelpdeskData.tickets.find((item) => item.ticketNo === ticketNo);
      if (baseTicket) {
        ticket = { ...baseTicket };
        saved.push(ticket);
      }
    }
    if (ticket) {
      ticket.category = category;
      ticket.updatedAt = new Date().toISOString();
      this.saveTickets(saved);
    }
  },
  updateAssignee(ticketNo, assignee) {
    const saved = this.getSavedTickets();
    let ticket = saved.find((item) => item.ticketNo === ticketNo);
    if (!ticket) {
      const baseTicket = window.HelpdeskData.tickets.find((item) => item.ticketNo === ticketNo);
      if (baseTicket) {
        ticket = { ...baseTicket };
        saved.push(ticket);
      }
    }
    if (ticket) {
      ticket.assignee = assignee.trim();
      ticket.updatedAt = new Date().toISOString();
      this.saveTickets(saved);
    }
  },
  updateSolution(ticketNo, solution) {
    const saved = this.getSavedTickets();
    let ticket = saved.find((item) => item.ticketNo === ticketNo);
    if (!ticket) {
      const baseTicket = window.HelpdeskData.tickets.find((item) => item.ticketNo === ticketNo);
      if (baseTicket) {
        ticket = { ...baseTicket };
        saved.push(ticket);
      }
    }
    if (ticket) {
      ticket.solution = solution.trim();
      ticket.updatedAt = new Date().toISOString();
      this.saveTickets(saved);
    }
  },
  makeTicketNo() {
    const now = new Date();
    const yearCode = this.getBuddhistYearCode(now);
    const maxSeq = this.getMaxSequenceForYear(yearCode);
    return this.makeTicketNoForSequence(now, maxSeq + 1);
  }
};
