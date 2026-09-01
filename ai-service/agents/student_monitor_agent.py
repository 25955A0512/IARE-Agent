"""
student_monitor_agent.py — Specialist Agent for Student Academic Monitoring & Telemetry.

Analyzes student academic telemetry synchronized from the Samvidha portal:
- Real-time overall and subject-wise attendance percentages with encouraging guidance.
- Student profile details (Name, Roll No, DOB, Photo, Blood Group, Gender, Dept).
- Current semester timetable & daily class schedules.
- Lab submission dates, experiment records, and assignment deadlines.
- Samvidha live campus notices, examination circulars, and placement drives.
- Safe bunk and attendance recovery calculations (75% cutoff threshold).
- Continuous Internal Evaluation (CIE) marks.
"""

from typing import Any, Dict, List, Optional
import logging

log = logging.getLogger(__name__)


class StudentMonitorAgent:
    """Specialist agent that provides warm, encouraging academic telemetry answers."""

    def handle(self, query: str, student_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Processes a student query using the attached Samvidha context."""
        q = query.lower().strip()

        if not student_context or not student_context.get("rollNo"):
            return {
                "success": True,
                "agent": "student_monitor",
                "message": (
                    "🎓 **Connect Your Samvidha Portal!**\n\n"
                    "I noticed your **IARE Samvidha** account isn't synchronized yet. "
                    "Once you log in with your Roll Number & Password in the **Student Academic Hub**, "
                    "I will load your live attendance, lab submissions, and daily schedule directly from the portal!"
                ),
            }

        roll_no = student_context.get("rollNo", "Student")
        name = student_context.get("fullName", f"Student {roll_no}")
        dob = student_context.get("dob", "N/A")
        gender = student_context.get("gender", "N/A")
        blood_group = student_context.get("bloodGroup", "N/A")
        dept = student_context.get("department", "IARE Department")
        year = student_context.get("yearOfStudy", 2)
        sem = student_context.get("semester", 4)
        section = student_context.get("section", "A")
        overall_att = student_context.get("overallAttendance", 0.0)
        status = student_context.get("attendanceStatus", "GOOD")
        safe_bunks = student_context.get("safeBunksAvailable", 0)
        needed_75 = student_context.get("classesNeededFor75", 0)
        attendance_list = student_context.get("attendance", [])
        today_schedule = student_context.get("todaySchedule", [])
        marks_list = student_context.get("marks", [])
        lab_list = student_context.get("labSubmissions", [])
        notices_list = student_context.get("notices", [])

        # 1. Profile / Name / Details queries
        if any(w in q for w in ["what is my name", "what's my name", "tell my name", "my name", "my real name"]):
            return {
                "success": True,
                "agent": "student_monitor",
                "message": (
                    f"You are **{name}** (Roll No: `{roll_no}`), studying in **{dept}** (Year {year}, Sem {sem}, Sec {section})! 🎓\n\n"
                    f"• **Date of Birth:** 🎂 `{dob}`\n"
                    f"• **Gender & Blood Group:** {gender} | 🩸 `{blood_group}`\n"
                    f"• **Overall Attendance:** **{overall_att:.1f}%** ({status})"
                ),
            }

        if any(w in q for w in ["who am i", "my profile", "my details", "dob", "date of birth", "my info", "student details", "blood group"]):
            return {
                "success": True,
                "agent": "student_monitor",
                "message": (
                    f"🎓 **Here are your official IARE student details, {name}:**\n\n"
                    f"• **Full Name:** **{name}**\n"
                    f"• **Roll Number:** `{roll_no}`\n"
                    f"• **Department:** {dept} — Year {year}, Sem {sem} ({section})\n"
                    f"• **Date of Birth:** 🎂 `{dob}`\n"
                    f"• **Gender & Blood Group:** {gender} | 🩸 `{blood_group}`\n"
                    f"• **Overall Attendance:** **{overall_att:.1f}%** ({status})"
                ),
            }

        # 2. Lab Submissions & Deadlines
        if any(w in q for w in ["lab", "submission", "experiment", "due date", "deadline", "assignment"]):
            return self._handle_lab_submissions_query(name, lab_list)

        # 3. Events & Circulars
        if any(w in q for w in ["event", "notice", "circular", "placement", "recruitment", "drive", "notification", "announcement"]):
            return self._handle_notices_query(name, notices_list)

        # 4. Timetable & Schedule
        if any(w in q for w in ["next class", "current class", "timetable", "schedule", "today's class", "where is my class", "period"]):
            return self._handle_timetable_query(name, today_schedule)

        # 5. Marks & Evaluation
        if any(w in q for w in ["mark", "cie", "internal", "score", "grade"]):
            return self._handle_marks_query(name, roll_no, marks_list)

        # 6. Bunk & Leave calculations
        if any(w in q for w in ["bunk", "miss", "leave", "skip", "recover", "reach 75"]):
            return self._handle_bunk_query(name, overall_att, safe_bunks, needed_75)

        # 7. Default Attendance Report
        return self._handle_attendance_query(name, roll_no, overall_att, status, safe_bunks, needed_75, attendance_list)

    def _handle_lab_submissions_query(self, name: str, lab_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Summarizes upcoming lab submission dates and experiment records."""
        if not lab_list:
            return {
                "success": True,
                "agent": "student_monitor",
                "message": f"🔬 Great news, **{name}**! You're completely caught up — no pending lab submissions recorded right now. 🎉",
            }

        lines = [f"Here is your current lab submission checklist, **{name}**: 🔬\n"]
        for lab in lab_list:
            sub_name = lab.get("subjectName", "Laboratory")
            exp = lab.get("experimentName", "Experiment")
            due = lab.get("dueDate", "Upcoming")
            stat = lab.get("status", "PENDING")
            marks = lab.get("marksObtained")

            status_badge = "⏳ **PENDING**" if stat == "PENDING" else f"✅ **EVALUATED** ({marks}/10)"
            lines.append(f"• **{sub_name}** — {status_badge}\n  📝 *{exp}*\n  📅 Due Date: `{due}`")

        lines.append("\nLet me know if you want help understanding the code or theory for any of these experiments!")
        return {
            "success": True,
            "agent": "student_monitor",
            "message": "\n".join(lines),
        }

    def _handle_notices_query(self, name: str, notices_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Summarizes live Samvidha notice board, circulars, and recruitment drives."""
        if not notices_list:
            return {
                "success": True,
                "agent": "student_monitor",
                "message": f"📢 All quiet on the notice board right now, **{name}**! No active circulars currently posted.",
            }

        lines = [f"Here are the latest official campus notices & announcements, **{name}**: 📢\n"]
        for n in notices_list[:6]:
            title = n.get("title", "Notice")
            date = n.get("noticeDate", "")
            cat = n.get("category", "ACADEMIC")
            icon = "💼" if cat == "PLACEMENT" else ("📝" if cat == "EXAMINATION" else "📌")
            lines.append(f"{icon} **{title}**\n   🗓️ *{date}*")

        return {
            "success": True,
            "agent": "student_monitor",
            "message": "\n".join(lines),
        }

    def _handle_attendance_query(
        self,
        name: str,
        roll_no: str,
        overall: float,
        status: str,
        safe_bunks: int,
        needed: int,
        attendance_list: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Generates an encouraging, detailed summary of student attendance."""
        status_icon = "🟢" if overall >= 75.0 else ("🟡" if overall >= 65.0 else "🔴")
        if overall >= 75.0:
            status_text = "You're in great shape and fully eligible for exams! 🎉"
            buffer_text = f"You have a comfortable buffer of **{safe_bunks} class(es)** you could miss if you need a break, while still staying above 75%."
        elif overall >= 65.0:
            status_text = "You're in the condonation zone (65%–75%). Let's boost it back up! 💪"
            buffer_text = f"You need to attend your next **{needed} consecutive class(es)** to safely cross the 75% line."
        else:
            status_text = "Attendance alert: Below 65% shortage threshold."
            buffer_text = f"Make sure to attend your next **{needed} classes** to get back on track and avoid condonation fees."

        lines = [
            f"Here is your attendance snapshot, **{name}** ({roll_no}): 📊\n",
            f"• **Overall Attendance:** **{overall:.1f}%** {status_icon}",
            f"• **Standing:** {status_text}",
            f"• **Buffer / Recovery:** {buffer_text}",
        ]

        if attendance_list:
            lines.append("\n📚 **Subject-by-Subject Breakdown:**")
            for sub in attendance_list:
                pct = sub.get("percentage", 0.0)
                sub_name = sub.get("subjectName", "Subject")
                att = sub.get("attendedClasses", 0)
                tot = sub.get("totalClasses", 0)
                dot = "🟢" if pct >= 75.0 else ("🟡" if pct >= 65.0 else "🔴")
                lines.append(f"  {dot} **{sub_name}**: {pct:.1f}% ({att}/{tot} classes attended)")

        return {
            "success": True,
            "agent": "student_monitor",
            "message": "\n".join(lines),
        }

    def _handle_bunk_query(self, name: str, overall: float, safe_bunks: int, needed: int) -> Dict[str, Any]:
        """Calculates bunk allowance or makeup classes needed with friendly advice."""
        if overall >= 75.0:
            return {
                "success": True,
                "agent": "student_monitor",
                "message": (
                    f"🟢 **Safe Bunk Calculator for {name}**\n\n"
                    f"You're currently sitting comfortably at **{overall:.1f}%** overall attendance! 👏\n\n"
                    f"✅ **Safe Buffer:** You can safely miss up to **{safe_bunks} class(es)** while staying above the mandatory 75% cutoff for IARE exams.\n\n"
                    f"💡 *Tip: It's always great to save a couple of buffer classes for unexpected emergencies later in the semester!*"
                ),
            }
        else:
            return {
                "success": True,
                "agent": "student_monitor",
                "message": (
                    f"⚠️ **Attendance Recovery Plan for {name}**\n\n"
                    f"Your attendance is currently **{overall:.1f}%**, which is just below the 75% mark.\n\n"
                    f"🎯 **Action Plan:** You shouldn't miss any classes right now. Attending your next **{needed} consecutive class(es)** will bring your attendance right back over 75%!\n\n"
                    f"You've got this — let's lock in those upcoming sessions!"
                ),
            }

    def _handle_timetable_query(self, name: str, today_schedule: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Summarizes today's class schedule and current/next class."""
        if not today_schedule:
            return {
                "success": True,
                "agent": "student_monitor",
                "message": f"📅 No classes scheduled for today, **{name}**! Enjoy your free time or use it for project prep. 🎉",
            }

        lines = [f"Here is your daily schedule for today, **{name}**: 📅\n"]
        for slot in today_schedule:
            start = slot.get("timeSlotStart", "")
            end = slot.get("timeSlotEnd", "")
            sub = slot.get("subjectName", "")
            room = slot.get("room", "")
            faculty = slot.get("facultyName", "")
            is_curr = slot.get("isCurrent", False)
            is_nxt = slot.get("isNext", False)

            badge = " 🔴 **[HAPPENING NOW]**" if is_curr else (" ⏱️ **[UP NEXT]**" if is_nxt else "")
            lines.append(f"• **{start} – {end}**: {sub}{badge}\n  📍 Venue: *{room}* | 👤 Faculty: *{faculty}*")

        lines.append("\nNeed directions to any of these classrooms? Just ask me!")
        return {
            "success": True,
            "agent": "student_monitor",
            "message": "\n".join(lines),
        }

    def _handle_marks_query(self, name: str, roll_no: str, marks_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Summarizes CIE internal marks with positive encouragement."""
        if not marks_list:
            return {
                "success": True,
                "agent": "student_monitor",
                "message": f"📝 No Continuous Internal Evaluation (CIE) records uploaded yet for **{name}** ({roll_no}). Check back after the next evaluation cycle!",
            }

        lines = [f"Here is your Continuous Internal Evaluation (CIE) summary, **{name}**: 📝\n"]
        for m in marks_list:
            sub = m.get("subjectName", "Subject")
            c1 = m.get("cie1", "-")
            c2 = m.get("cie2", "-")
            tot = m.get("internalTotal", "-")
            lines.append(f"• **{sub}**\n  CIE-1: `{c1}/25` | CIE-2: `{c2}/25` | Total Internal: **`{tot}/25`**")

        lines.append("\nKeep up the great effort! If you'd like practice questions on any specific subject, just let me know.")
        return {
            "success": True,
            "agent": "student_monitor",
            "message": "\n".join(lines),
        }
