(() => {
      const $ = selector => document.querySelector(selector);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const esc = value => String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char]));

      const dateISO = date => {
        const value = new Date(date);
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
      };

      const plusDays = amount => {
        const date = new Date(today);
        date.setDate(date.getDate() + amount);
        return dateISO(date);
      };

      const semesters = Array.from({ length: 8 }, (_, index) => `Sem ${index + 1}`);

      const starter = [
        { id: "seed1", title: "Cell structure lab report", subject: "Biology", dueDate: plusDays(1), semester: "Sem 1", status: "In progress" },
        { id: "seed2", title: "Chapter 6 problem set", subject: "Mathematics", dueDate: plusDays(3), semester: "Sem 1", status: "Not started" },
        { id: "seed3", title: "Modernism reading response", subject: "English", dueDate: plusDays(5), semester: "Sem 1", status: "Not started" },
        { id: "seed4", title: "Photosynthesis quiz prep", subject: "Biology", dueDate: plusDays(8), semester: "Sem 1", status: "In progress" },
        { id: "seed5", title: "Research methods worksheet", subject: "Psychology", dueDate: plusDays(-1), semester: "Sem 1", status: "Not started" },
        { id: "seed6", title: "Limits and continuity review", subject: "Mathematics", dueDate: plusDays(-4), semester: "Sem 1", status: "Done" }
      ];

      let user = null;
      let items = [];
      let view = "all";
      let editing = null;
      let toastTimer;

      const loadUser = () => {
        try {
          user = JSON.parse(localStorage.getItem("studytrack.user"));
        } catch {
          user = null;
        }

        if (!user?.email) return;

        $("#loginScreen").style.display = "none";
        $("#app").classList.add("visible");
        $("#userName").textContent = user.name.split(" ")[0];
        $("#greetingName").textContent = user.name.split(" ")[0];
        $("#avatar").textContent = user.name.trim().charAt(0).toUpperCase();
        $("#todayLabel").textContent = new Intl.DateTimeFormat("en", {
          weekday: "short",
          month: "short",
          day: "numeric"
        }).format(new Date());

        const key = "studytrack.assignments." + user.email;

        try {
          items = JSON.parse(localStorage.getItem(key)) || [];
        } catch {
          items = [];
        }

        if (!localStorage.getItem(key)) {
          items = starter.map(item => ({ ...item }));
          save();
        } else {
          let migrated = false;
          items = items.map(item => {
            if (!semesters.includes(item.semester)) {
              migrated = true;
              return { ...item, semester: "Sem 1" };
            }
            return item;
          });
          if (migrated) save();
        }

        render();
      };

      const save = () => {
        if (user) {
          localStorage.setItem("studytrack.assignments." + user.email, JSON.stringify(items));
        }
      };

      const formatDate = value => new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric"
      }).format(new Date(value + "T12:00:00"));

      const dayDiff = value => Math.round(
        (new Date(value + "T00:00:00") - today) / 86400000
      );

      const dateMeta = assignment => {
        const difference = dayDiff(assignment.dueDate);

        if (assignment.status === "Done") {
          return { text: formatDate(assignment.dueDate), meta: "Completed", cls: "" };
        }

        if (difference < 0) {
          const days = Math.abs(difference);
          return { text: formatDate(assignment.dueDate), meta: `${days} day${days === 1 ? "" : "s"} overdue`, cls: "overdue" };
        }

        if (difference === 0) {
          return { text: "Today", meta: "Due today", cls: "soon" };
        }

        if (difference <= 3) {
          return {
            text: formatDate(assignment.dueDate),
            meta: difference === 1 ? "Due tomorrow" : `Due in ${difference} days`,
            cls: "soon"
          };
        }

        return {
          text: formatDate(assignment.dueDate),
          meta: difference <= 7 ? "Due this week" : "",
          cls: ""
        };
      };

      const icon = name => {
        if (name === "check") {
          return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>`;
        }

        if (name === "edit") {
          return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>`;
        }

        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg>`;
      };

      const fillSelect = (element, values, label) => {
        const oldValue = element.value;
        element.innerHTML = `<option value="">${label}</option>` +
          values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("");

        if (values.includes(oldValue)) element.value = oldValue;
      };

      const render = () => {
        const active = items.filter(item => item.status !== "Done");
        const dueThisWeek = active.filter(item => dayDiff(item.dueDate) >= 0 && dayDiff(item.dueDate) <= 7);

        $("#activeCount").textContent = active.length;
        $("#weekCount").textContent = dueThisWeek.length;
        $("#doneCount").textContent = items.filter(item => item.status === "Done").length;

        const subjects = [...new Set(items.map(item => item.subject).filter(Boolean))].sort();
        fillSelect($("#subjectFilter"), subjects, "All subjects");
        fillSelect($("#semesterFilter"), semesters, "All semesters");

        const selectedSubject = $("#subjectFilter").value;
        const selectedSemester = $("#semesterFilter").value;
        const selectedStatus = $("#statusFilter").value;

        let filtered = items.filter(item =>
          (!selectedSubject || item.subject === selectedSubject) &&
          (!selectedSemester || item.semester === selectedSemester) &&
          (!selectedStatus || item.status === selectedStatus)
        );

        if (view === "upcoming") {
          filtered = filtered.filter(item => item.status !== "Done" && dayDiff(item.dueDate) >= 0);
        }

        if (view === "completed") {
          filtered = filtered.filter(item => item.status === "Done");
        }

        filtered.sort((a, b) => {
          if (a.status === "Done" && b.status !== "Done") return 1;
          if (b.status === "Done" && a.status !== "Done") return -1;
          return a.dueDate.localeCompare(b.dueDate);
        });

        $("#listCount").textContent = `· ${filtered.length}`;
        $("#semesterNavText").textContent = items[0]?.semester || "Sem 1";

        if (filtered.length === 0) {
          $("#assignmentList").innerHTML = `
            <div class="empty">
              <b>${items.length ? "Nothing on this list" : "Your first step starts here"}</b>
              <p>${items.length
                ? "Try changing a filter, or enjoy the breathing room."
                : "Add an assignment and get your semester into sync."}</p>
            </div>`;
          return;
        }

        $("#assignmentList").innerHTML = filtered.map(assignment => {
          const date = dateMeta(assignment);
          const statusClass = assignment.status.toLowerCase().replaceAll(" ", "-");

          return `
            <article class="assignment ${date.cls === "overdue" ? "overdue" : ""}">
              <div>
                <div class="task-title">
                  <span class="task-dot ${assignment.status === "Done" ? "complete" : ""}"></span>
                  ${esc(assignment.title)}
                </div>
                <div class="task-subtitle">
                  ${assignment.status === "Done"
                    ? "Nicely done ✨"
                    : assignment.status === "In progress"
                      ? "You’re making progress"
                      : "Ready when you are"}
                </div>
              </div>

              <div class="subject">${esc(assignment.subject)}</div>
              <div class="due ${date.cls}">
                ${esc(date.text)}
                ${date.meta ? `<small>${esc(date.meta)}</small>` : ""}
              </div>
              <div><span class="semester">${esc(assignment.semester)}</span></div>

              <div style="display:flex;align-items:center;justify-content:space-between;gap:4px">
                <span class="status ${statusClass}">${esc(assignment.status)}</span>
                <div class="actions">
                  ${assignment.status !== "Done" ? `
                    <button class="icon-btn" data-action="done" data-id="${esc(assignment.id)}"
                      title="Mark as done" aria-label="Mark ${esc(assignment.title)} as done">${icon("check")}</button>
                  ` : ""}
                  <button class="icon-btn" data-action="edit" data-id="${esc(assignment.id)}"
                    title="Edit" aria-label="Edit ${esc(assignment.title)}">${icon("edit")}</button>
                  <button class="icon-btn" data-action="delete" data-id="${esc(assignment.id)}"
                    title="Delete" aria-label="Delete ${esc(assignment.title)}">${icon("delete")}</button>
                </div>
              </div>
            </article>`;
        }).join("");
      };

      const showToast = message => {
        $("#toast").textContent = message;
        $("#toast").classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 2200);
      };

      const openModal = assignment => {
        editing = assignment?.id || null;
        $("#assignmentForm").reset();
        $("#modalTitle").textContent = assignment ? "Edit assignment" : "Add an assignment";
        $("#saveAssignment").textContent = assignment ? "Save changes" : "Save assignment";

        if (assignment) {
          for (const field of ["title", "subject", "dueDate", "semester", "status"]) {
            $("#assignmentForm").elements[field].value = assignment[field];
          }
        } else {
          $("#statusInput").value = "Not started";
          $("#semesterInput").value = $("#semesterFilter").value || $("#semesterNavText").textContent;
        }

        $("#modalBackdrop").classList.add("open");
        setTimeout(() => $("#titleInput").focus(), 50);
      };

      $("#loginForm").addEventListener("submit", event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        user = {
          name: String(data.get("name")).trim(),
          email: String(data.get("email")).trim().toLowerCase()
        };
        localStorage.setItem("studytrack.user", JSON.stringify(user));
        loadUser();
      });

      $("#addButton").addEventListener("click", () => openModal());

      $("#closeModal").addEventListener("click", () => $("#modalBackdrop").classList.remove("open"));
      $("#cancelModal").addEventListener("click", () => $("#modalBackdrop").classList.remove("open"));

      $("#modalBackdrop").addEventListener("click", event => {
        if (event.target === $("#modalBackdrop")) {
          $("#modalBackdrop").classList.remove("open");
        }
      });

      document.addEventListener("keydown", event => {
        if (event.key === "Escape") $("#modalBackdrop").classList.remove("open");
      });

      $("#assignmentForm").addEventListener("submit", event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const assignment = {
          id: editing || crypto.randomUUID(),
          title: String(data.get("title")).trim(),
          subject: String(data.get("subject")).trim(),
          dueDate: String(data.get("dueDate")),
          semester: String(data.get("semester")),
          status: String(data.get("status"))
        };

        if (editing) {
          items = items.map(item => item.id === editing ? assignment : item);
          showToast("Assignment updated");
        } else {
          items.push(assignment);
          showToast("Assignment added");
        }

        save();
        render();
        $("#modalBackdrop").classList.remove("open");
      });

      $("#assignmentList").addEventListener("click", event => {
        const button = event.target.closest("[data-action]");
        if (!button) return;

        const assignment = items.find(item => item.id === button.dataset.id);
        if (!assignment) return;

        if (button.dataset.action === "done") {
          assignment.status = "Done";
          save();
          render();
          showToast("Marked done. Nice work! ✨");
        } else if (button.dataset.action === "edit") {
          openModal(assignment);
        } else if (button.dataset.action === "delete") {
          items = items.filter(item => item.id !== assignment.id);
          save();
          render();
          showToast("Assignment removed");
        }
      });

      ["subjectFilter", "semesterFilter", "statusFilter"].forEach(id => {
        $("#" + id).addEventListener("change", render);
      });

      document.querySelectorAll(".nav-item[data-view]").forEach(button => {
        button.addEventListener("click", () => {
          view = button.dataset.view;
          document.querySelectorAll(".nav-item[data-view]").forEach(item => {
            item.classList.toggle("active", item === button);
          });
          render();
        });
      });

      $("#semesterNav").addEventListener("click", () => {
        $("#semesterFilter").value = $("#semesterNavText").textContent;
        view = "all";
        document.querySelectorAll(".nav-item[data-view]").forEach(item => {
          item.classList.toggle("active", item.dataset.view === "all");
        });
        render();
      });

      $("#accountButton").addEventListener("click", () => {
        $("#accountMenu").classList.toggle("open");
      });

      $("#signOut").addEventListener("click", () => {
        localStorage.removeItem("studytrack.user");
        user = null;
        $("#app").classList.remove("visible");
        $("#loginScreen").style.display = "grid";
        $("#accountMenu").classList.remove("open");
      });

      loadUser();
    })();
