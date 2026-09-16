# Hive Mind — Learning Management System

A full‑stack learning management system for course creators, teachers, and
students. Teachers publish courses, assignments and quizzes, review and grade
every submission at a glance, and export results to CSV. Students complete
quizzes, submit assignments, and track their progress.

The project lives in three parts that stay in sync:

| Path       | What it is                                                            | Where it deploys        |
| ---------- | --------------------------------------------------------------------- | ----------------------- |
|   `src/`     | Spring Boot backend (MySQL) + static frontend served by the app       | Render / Railway / VPS / Docker |
| `web/`     | Standalone copy of the frontend, wired for a static host              | Vercel                  |
| `Dockerfile` | Container image for the backend                                      | Any Docker host         |

### Running build

The repo builds with **JDK 21**, **Spring Boot 4.1.0** (Spring Framework 7,
Tomcat 11), Spring JDBC over **MySQL 8**. Any MySQL server works, local or
cloud (Aiven / Railway / RDS …).

---

## Tech stack

- **Java 21** + **Spring Boot 4.1** (Spring Framework 7, Tomcat 11)
- Spring JDBC (`JdbcClient`) over **MySQL**
- Vanilla HTML/CSS/JS frontend (no build step) — the UI is progressively
  enhanced and themeable via CSS custom properties
- Session‑based authentication (HttpOnly `SameSite=Lax` cookie), HSTS,
  per‑account login/register rate limiting, and an audit trail for
  admin actions

## Roles

- **Student** — browse enrolled courses, watch lessons and read notes, submit
  assignments, take auto‑graded quizzes, and track progress.
- **Teacher** — manage courses/resources, create assignments and quizzes,
  review and grade submissions inline, and export marks/grades to CSV.
- **Organization admin** — manage users, courses, categories, reviews,
  audit, and analytics.

Organizations group teachers and students; enrollments are course‑scoped.

---

## Run it locally

Prere ches: JDK 21, Maven (or the bundled `./mvnw` wrapper), and a MySQL
server with an empty `lms_db` (created automatically).

```bash
# 1. From the repo root (repo is a sub‑module of the backend artifact):
git clone https://github.com/yash-phadtare/HiveMind.git
cd Hive-Mind

# 2. Create the schema (run once, or let Spring do it via schema.sql)
mysql -u root -p lms_db < src/main/resources/schema.sql

# 3. Point the datasource at your database (see application.properties)
#    DB_URL / DB_USERNAME / DB_PASSWORD env vars, with sensible local defaults

# 4. Build and run
./mvnw -DskipTests package
java -jar target/backend-0.0.1-SNAPSHOT.jar
# → http://localhost:8080
```

> Note (Windows): running `clean package` in one pass can occasionally leave
> `target/classes` empty and fail the `repackage` step. If the build fails
> with "Unable to find main class", just run `./mvnw -DskipTests compile`
> once first, then `./mvnw -q -DskipTests package` again.

### Environment variables

| Variable        | Default                | Purpose                                  |
| --------------- | ---------------------- | ---------------------------------------- |
| `DB_URL`        | `jdbc:mysql://localhost:3306/lms_db…` | JDBC URL            |
| `DB_USERNAME`   | `root`                 | DB user                                  |
| `DB_PASSWORD`   | `RandomBullshitGo`     | DB password                              |
| `COOKIE_SECURE` | (off locally)          | Set `true` on HTTPS deployments          |
| `APP_API`       | *(set in `web/app.js`)*| Backend base URL for the static build    |

---

## Deploying

### Static frontend (Vercel)

`web/` contains a self‑contained copy of the frontend plus `vercel.json`,
which rewrites `/api/:path*` to your backend’s public host. Set
`APP_API`/rewrite target before deploying and keep `web/` synced with any
`src/main/resources/static` changes.

```bash
cp src/main/resources/static/*.js \
   src/main/resources/static/*.html \
   src/main/resources/static/*.css web/
```

### Backend

Two options:

1. **Jar** — `java -jar target/backend-0.0.1-SNAPSHOT.jar` behind any
   reverse proxy; forward `X-Forwarded-*` headers (already configured via
   `server.forward-headers-strategy=native`).
2. **Docker** — `docker build -t hive-mind .` with `SPRING_*`/`DB_*` env
   overrides; the `Dockerfile` uses a JRE 21 image and a non‑root user.

---

## CSV export (teacher)

Both the assignment grading and quiz‑results sections offer
**Export grades to CSV** — a UTF‑8 BOM CSV (Excel‑friendly) with one row per
student, including score, max score, percentage, letter grade (assignments)
and feedback, keyed by the assignment/quiz name in the filename.

---

## Project layout

```
src/main/java/com/lms/backend/
  admin/        admin controllers + repository (users, courses, audit…)
  auth/         login/register + session auth
  audit/        audit log model + writing
  config/       security, rate limiting, web config
  content/      file/media storage for lessons
  student/      student endpoints + repository
  teacher/      teacher endpoints + repository (grading, CSV data)
  user/         user model + auth response
src/main/resources/
  schema.sql            idempotent DDL (incl. per‑environment column adds)
  static/               HTML/JS/CSS frontend + public assets
```
