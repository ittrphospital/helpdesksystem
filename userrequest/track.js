function findTicket(ticketNo) {
  return window.HelpdeskStore.getTickets().find((ticket) => ticket.ticketNo.toLowerCase() === ticketNo.trim().toLowerCase());
}

function showTicket() {
  const value = document.getElementById("ticketNo").value;
  const ticket = findTicket(value);
  const result = document.getElementById("trackResult");
  if (!ticket) {
    result.innerHTML = `<div class="notice">ไม่พบเลข Ticket นี้ กรุณาตรวจสอบเลขอีกครั้ง</div>`;
    return;
  }
  result.innerHTML = `
    <div class="ticket-result">
      <div><strong>${ticket.ticketNo}</strong> <span class="pill ${statusClass(ticket.status)}">${ticket.status}</span></div>
      <div>หัวข้อ: ${ticket.title}</div>
      <div>ผู้แจ้ง: ${ticket.requesterName}</div>
      <div>แผนก: ${ticket.department}</div>
      <div>ประเภท: ${ticket.category}</div>
      <div>ความเร่งด่วน: ${ticket.priority}</div>
      <div>แจ้งเมื่อ: ${formatDateTime(ticket.createdAt)}</div>
      <div>อัปเดตล่าสุด: ${formatDateTime(ticket.updatedAt)}</div>
      <div>รายละเอียด: ${ticket.description}</div>
      <div>ผู้ดำเนินการ: ${ticket.assignee || "-"}</div>
    </div>
  `;
}

document.getElementById("trackButton").addEventListener("click", showTicket);
document.getElementById("ticketNo").addEventListener("keydown", (event) => {
  if (event.key === "Enter") showTicket();
});
setFooterMetrics(window.HelpdeskStore.getTickets().length);
