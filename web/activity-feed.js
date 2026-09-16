/* Shared recent-activity feed renderer for the role dashboards.
   Exposes window.HiveActivity.render(ol, activities) where each item is:
   { type, title, actor, metric, stamp }. Call .self(name) to label own actions
   as "You". */
(function () {
  var selfName = null;
  var checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>';
  var xSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  var pauseSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>';
  var zapSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';

  var ICONS = {
    teacher_registered:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    teacher_approved: checkSvg,
    teacher_rejected: xSvg,
    teacher_suspended: pauseSvg,
    teacher_activated: zapSvg,
    student_registered:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    student_approved: checkSvg,
    student_rejected: xSvg,
    student_suspended: pauseSvg,
    student_activated: zapSvg,
    course_submitted:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
    course_approved: checkSvg,
    course_rejected: xSvg,
    course_suspended: pauseSvg,
    enrollment:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    assignment_submitted:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12l2 2 4-4"/></svg>',
    assignment_graded: checkSvg,
    quiz_completed:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };

  var TINTS = {
    teacher_registered: "cyan",
    teacher_approved: "cyan",
    teacher_rejected: "rose",
    teacher_suspended: "amber",
    teacher_activated: "mint",
    student_registered: "cyan",
    student_approved: "cyan",
    student_rejected: "rose",
    student_suspended: "amber",
    student_activated: "mint",
    course_submitted: "accent",
    course_approved: "mint",
    course_rejected: "rose",
    course_suspended: "amber",
    enrollment: "lime",
    assignment_submitted: "amber",
    assignment_graded: "mint",
    quiz_completed: "violet",
  };

  function timeAgo(stamp) {
    if (!stamp) return "";
    var seconds = Math.floor((Date.now() - new Date(stamp).getTime()) / 1000);
    if (!Number.isFinite(seconds) || seconds < 45) return "just now";
    var units = [
      [31536000, "year"],
      [2592000, "month"],
      [604800, "week"],
      [86400, "day"],
      [3600, "hour"],
      [60, "minute"],
    ];
    for (var i = 0; i < units.length; i++) {
      if (seconds >= units[i][0]) {
        var value = Math.floor(seconds / units[i][0]);
        return value + " " + units[i][1] + (value > 1 ? "s" : "") + " ago";
      }
    }
    return seconds + "s ago";
  }

  function normalizedActor(item) {
    var actor = item.actor || "";
    if (!selfName || !actor) return actor;
    return actor.localeCompare(selfName, undefined, { sensitivity: "base" }) === 0
      ? "You"
      : actor;
  }

  /* Build phrase as [{ s: text }, { k: strong text }] segments. */
  function parts(item) {
    var actor = normalizedActor(item);
    var name = actor || "Someone";
    var title = item.title || "";
    switch (item.type) {
      case "teacher_registered":
        return [{ k: title || name }, { s: " registered as a teacher" }];
      case "teacher_approved":
        return [{ k: name }, { s: " approved teacher " }, { k: title || "a teacher" }];
      case "teacher_rejected":
        return [{ k: name }, { s: " rejected teacher " }, { k: title || "a teacher" }];
      case "teacher_suspended":
        return [{ k: name }, { s: " suspended teacher " }, { k: title || "a teacher" }];
      case "teacher_activated":
        return [{ k: name }, { s: " re-activated teacher " }, { k: title || "a teacher" }];
      case "student_registered":
        return [{ k: title || name }, { s: " registered as a student" }];
      case "student_approved":
        return [{ k: name }, { s: " approved " }, { k: title || "a student" }];
      case "student_rejected":
        return [{ k: name }, { s: " rejected " }, { k: title || "a student" }];
      case "student_suspended":
        return [{ k: name }, { s: " suspended " }, { k: title || "a student" }];
      case "student_activated":
        return [{ k: name }, { s: " re-activated " }, { k: title || "a student" }];
      case "course_submitted":
        return [
          { s: "Course " },
          { k: title || "\u2192 new course" },
          { s: actor && actor !== "You" ? " \u2014 by " + actor : " submitted for approval" },
        ];
      case "course_approved":
        return [{ k: name }, { s: " approved " }, { k: title || "a course" }];
      case "course_rejected":
        return [{ k: name }, { s: " rejected " }, { k: title || "a course" }];
      case "course_suspended":
        return [{ k: name }, { s: " suspended " }, { k: title || "a course" }];
      case "enrollment":
        return actor && actor !== "You"
          ? [{ k: actor }, { s: " enrolled in " }, { k: title || "a course" }]
          : [{ k: "You" }, { s: " enrolled in " }, { k: title || "a course" }];
      case "assignment_submitted":
        return actor && actor !== "You"
          ? [{ k: actor }, { s: " submitted " }, { k: title || "an assignment" }]
          : [{ k: "You" }, { s: " submitted " }, { k: title || "an assignment" }];
      case "assignment_graded":
        return [
          { k: title || "Assignment" },
          { s: " graded \u00b7 " },
          { k: (item.metric != null ? item.metric : 0) + "%" },
        ];
      case "quiz_completed":
        return actor && actor !== "You"
          ? [
              { k: actor },
              { s: " scored " },
              { k: (item.metric != null ? item.metric : 0) + "%" },
              { s: " on " },
              { k: title || "a quiz" },
            ]
          : [
              { k: "You" },
              { s: " scored " },
              { k: (item.metric != null ? item.metric : 0) + "%" },
              { s: " on " },
              { k: title || "a quiz" },
            ];
      default:
        return [{ s: title || "Something happened" }];
    }
  }

  function textNode(text) {
    return document.createTextNode(text);
  }

  function strongNode(text) {
    var strong = document.createElement("strong");
    strong.textContent = text;
    return strong;
  }

  function buildPhrase(item) {
    var p = document.createElement("p");
    p.className = "activity-item__text";
    parts(item).forEach(function (segment) {
      if (segment.k) p.appendChild(strongNode(segment.k));
      if (segment.s) p.appendChild(textNode(segment.s));
    });
    return p;
  }

  var GRADE_TYPES = { assignment_graded: true, quiz_completed: true };

  window.HiveActivity = {
    self: function (name) {
      selfName = name || null;
    },
    timeAgo: timeAgo,
    render: function (container, activities) {
      container.replaceChildren();
      if (!activities || !activities.length) {
        var empty = document.createElement("li");
        empty.className = "activity-empty";
        var dot = document.createElement("span");
        dot.textContent = "\u2022";
        var label = document.createElement("span");
        label.textContent = "No activity yet \u2014 activity will appear here as your workspace grows.";
        empty.append(dot, label);
        container.appendChild(empty);
        return;
      }
      activities.forEach(function (item, index) {
        var li = document.createElement("li");
        li.className =
          "activity-item activity-item--" + (TINTS[item.type] || "accent");
        li.dataset.reveal = "";
        li.dataset.revealDelay = String(Math.min(index * 55, 385));

        var icon = document.createElement("span");
        icon.className = "activity-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.innerHTML = ICONS[item.type] || ICONS.course_submitted;

        var body = document.createElement("div");
        body.className = "activity-item__body";
        var time = document.createElement("small");
        time.className = "activity-item__time";
        time.textContent = timeAgo(item.stamp);
        body.append(buildPhrase(item), time);

        var meta = document.createElement("span");
        meta.className = "activity-item__meta";
        if (GRADE_TYPES[item.type] && item.metric != null) {
          meta.textContent = item.metric + "%";
        } else {
          meta.setAttribute("aria-hidden", "true");
        }

        li.append(icon, body, meta);
        container.appendChild(li);
      });
    },
  };
})();