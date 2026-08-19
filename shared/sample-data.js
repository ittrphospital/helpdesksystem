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
  getSavedTickets() {
    const tickets = JSON.parse(localStorage.getItem(this.key) || "[]");
    const migrated = this.migrateTicketNumbers(tickets);
    if (JSON.stringify(migrated) !== JSON.stringify(tickets)) {
      this.saveTickets(migrated);
    }
    return migrated;
  },
  saveTickets(tickets) {
    localStorage.setItem(this.key, JSON.stringify(tickets));
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
  getSampleTicketNos() {
    return new Set(window.HelpdeskData.tickets.map((ticket) => ticket.ticketNo));
  },
  getUserTickets() {
    const sampleTicketNos = this.getSampleTicketNos();
    return this.getSavedTickets().filter((ticket) => ticket.source === "user" || !sampleTicketNos.has(ticket.ticketNo));
  },
  getTickets() {
    const saved = this.getSavedTickets();
    const userTickets = this.getUserTickets();

    if (userTickets.length > 0) {
      return userTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const byTicketNo = new Map();
    window.HelpdeskData.tickets.forEach((ticket) => byTicketNo.set(ticket.ticketNo, ticket));
    saved.forEach((ticket) => byTicketNo.set(ticket.ticketNo, ticket));
    return Array.from(byTicketNo.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  addTicket(ticket) {
    const saved = this.getSavedTickets();
    const nextTicket = { ...ticket, source: ticket.source || "user" };
    const existingIndex = saved.findIndex((item) => item.ticketNo === nextTicket.ticketNo);
    if (existingIndex >= 0) {
      saved[existingIndex] = nextTicket;
    } else {
      saved.push(nextTicket);
    }
    this.saveTickets(saved);
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
    const ticketsForYear = this.getUserTickets().filter((ticket) => ticket.ticketNo.startsWith(`REQ-${yearCode}`));
    const maxSeq = ticketsForYear.reduce((max, ticket) => {
      const seq = Number(ticket.ticketNo.slice(6));
      return Number.isFinite(seq) ? Math.max(max, seq) : max;
    }, 0);
    return this.makeTicketNoForSequence(now, maxSeq + 1);
  }
};
