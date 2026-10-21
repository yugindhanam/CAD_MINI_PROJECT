import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  Search,
  Plus,
  MapPin,
  ArrowRight,
  Check,
  Package,
  LayoutGrid,
  ShieldCheck,
  X,
  LogOut,
  Clock,
  ChevronRight,
  SlidersHorizontal,
  Upload,
  GraduationCap,
} from "lucide-react";
import * as api from "./api";
import { categories, type Report, type State, type User } from "./domain";
import { glyphs } from "./seed";
import "./style.css";
function App() {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [data, setData] = useState<State>({ reports: [], claims: [] }),
    [page, setPage] = useState("home"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [selected, setSelected] = useState<Report | null>(null),
    [form, setForm] = useState<{ type: string; report?: Report } | null>(null),
    [query, setQuery] = useState(""),
    [type, setType] = useState("all"),
    [category, setCategory] = useState("all"),
    [location, setLocation] = useState("all"),
    [status, setStatus] = useState("all"),
    [limit, setLimit] = useState(9);
  async function refresh(u = user) {
    if (!u) return;
    setLoading(true);
    try {
      setData(await api.load(u));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    api
      .session()
      .then((u) => {
        setUser(u);
        setReady(true);
        if (u) refresh(u);
      })
      .catch((e) => {
        setError(e.message);
        setReady(true);
      });
  }, []);
  async function run(action: string, p: any) {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.mutate(user, action, p);
      await refresh();
      // Merge the transaction result so a briefly stale GSI read cannot undo the UI update.
      if (result)
        setData((current) => ({
          reports: result.report
            ? [
                result.report,
                ...current.reports.filter((r) => r.id !== result.report.id),
              ]
            : current.reports,
          claims: result.claim
            ? [
                result.claim,
                ...current.claims.filter((c) => c.id !== result.claim.id),
              ]
            : current.claims,
        }));
      setNotice("Saved successfully.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function navigate(p: string) {
    setPage(p);
    setQuery("");
    setType("all");
    setLimit(9);
    setError("");
  }
  if (!ready) return <div className="splash">Opening Campus Find…</div>;
  if (!user)
    return (
      <Login
        onLogin={async () => {
          const u = await api.session();
          setUser(u);
          await refresh(u);
        }}
      />
    );
  const filtered = data.reports.filter(
    (r) =>
      (type === "all" || r.type === type) &&
      (category === "all" || r.category === category) &&
      (location === "all" || r.location === location) &&
      (status === "all" || r.status === status) &&
      `${r.title} ${r.description} ${r.location}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="demo-strip">
        {api.demo
          ? "LOCAL DEMO · Sample data stored in this browser"
          : "CAMPUS COMMUNITY · Secure campus sign-in"}{" "}
        <span>{api.demo ? "No AWS connection" : "Verified access"}</span>
      </div>
      <header>
        <a className="brand" onClick={() => navigate("home")} href="#">
          <span className="brand-icon">
            <Package size={23} />
          </span>
          campus<span className="brand-light">find</span>
          <small>LOST & FOUND</small>
        </a>
        <nav>
          {[
            ["home", "Discover"],
            ["listings", "All listings"],
            ["dashboard", "My dashboard"],
            ...(user.admin ? [["admin", "Administration"]] : []),
          ].map(([p, label]) => (
            <button
              className={page === p ? "active" : ""}
              onClick={() => navigate(p)}
              key={p}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="profile">
          <span className="avatar">{user.admin ? "AD" : "AL"}</span>
          <div>
            <b>{user.admin ? "Administrator" : "Campus member"}</b>
            <small>{user.email}</small>
          </div>
          <button
            className="icon-button"
            title="Log out"
            onClick={async () => {
              await api.logout();
              setUser(null);
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>
      <main>
        {error && (
          <div className="alert error" role="alert">
            {error}
            <button onClick={() => setError("")} aria-label="Dismiss error">
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="alert success" role="status">
            <Check size={17} />
            {notice}
            <button
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {page === "home" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow">
                  <span /> A LITTLE HELP. A HAPPY REUNION.
                </span>
                <h1>
                  Lost something?
                  <br />
                  Let’s bring it <em>home.</em>
                </h1>
                <p>
                  A familiar place for things left behind. Connect with your
                  campus community and find what matters to you.
                </p>
                <div className="hero-actions">
                  <button
                    className="primary"
                    onClick={() => setForm({ type: "lost" })}
                  >
                    Report a lost item <ArrowUpRight size={18} />
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setForm({ type: "found" })}
                  >
                    I found something <Plus size={18} />
                  </button>
                </div>
                <div className="hero-foot">
                  <ShieldCheck size={18} /> Campus only. Community powered.
                </div>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="float-tag tag-one">
                  <span className="tag-check">
                    <Check size={15} />
                  </span>{" "}
                  Back where it belongs
                </div>
                <div className="bag">
                  <div className="handle" />
                  <div className="bag-body">
                    <div className="bag-label">
                      c<span>f</span>
                    </div>
                    <div className="bag-pocket" />
                  </div>
                </div>
                <div className="notebook">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="key-art">⚿</div>
                <div className="float-tag tag-two">
                  <MapPin size={15} /> Somewhere on campus <span>↗</span>
                </div>
                <span className="spark s1">✦</span>
                <span className="spark s2">✧</span>
              </div>
            </section>
            <section className="metrics">
              <div>
                <span className="metric-icon">
                  <Package />
                </span>
                <b>
                  {
                    data.reports.filter(
                      (r) => r.type === "found" && r.status === "open",
                    ).length
                  }
                  <small>Items waiting for their owners</small>
                </b>
              </div>
              <div>
                <span className="metric-icon">
                  <Check />
                </span>
                <b>
                  {data.reports.filter((r) => r.status === "returned").length}
                  <small>Happy reunions and counting</small>
                </b>
              </div>
              <div>
                <span className="metric-icon">
                  <GraduationCap />
                </span>
                <b>
                  One campus<small>A community that looks out for you</small>
                </b>
              </div>
            </section>
          </>
        )}
        {(page === "home" || page === "listings") && (
          <>
            <section className="section-title">
              <div>
                <span className="eyebrow teal">THE CAMPUS NOTICEBOARD</span>
                <h2>
                  {page === "home"
                    ? "A few things looking for home."
                    : "Find your missing piece."}
                </h2>
                <p>
                  Recognize something? A small detail could make someone’s day.
                </p>
              </div>
              {page === "home" ? (
                <button
                  className="text-button"
                  onClick={() => navigate("listings")}
                >
                  View all listings <ArrowRight size={17} />
                </button>
              ) : (
                <button
                  className="primary"
                  onClick={() => setForm({ type: "lost" })}
                >
                  <Plus size={17} /> Create report
                </button>
              )}
            </section>
            <div className="search-row">
              <label className="search">
                <Search size={19} />
                <input
                  aria-label="Search reports"
                  placeholder="Search for a calculator, keys, a blue backpack…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setLimit(9);
                  }}
                />
              </label>
              <label className="select-label">
                <SlidersHorizontal size={16} />
                <select
                  aria-label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <select
                aria-label="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="all">All locations</option>
                {[...new Set(data.reports.map((r) => r.location))].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
              <select
                aria-label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">All statuses</option>
                {["open", "claim approved", "returned", "closed"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="listing-toolbar">
              <div className="tabs">
                {[
                  ["all", "All items"],
                  ["lost", "Lost"],
                  ["found", "Found"],
                ].map(([v, t]) => (
                  <button
                    key={v}
                    className={type === v ? "selected" : ""}
                    onClick={() => setType(v)}
                  >
                    {t}
                    {v === "all" && <span>{data.reports.length}</span>}
                  </button>
                ))}
              </div>
              <small>
                {filtered.length} {filtered.length === 1 ? "item" : "items"} ·
                Most recent first
              </small>
            </div>
            {loading ? (
              <div className="empty">Loading campus reports…</div>
            ) : (
              <div className="cards">
                {filtered.slice(0, limit).map((r) => (
                  <ReportCard
                    key={r.id}
                    report={r}
                    onClick={() => setSelected(r)}
                  />
                ))}
              </div>
            )}
            {!loading && !filtered.length && (
              <div className="empty">
                <Search />
                <h3>No items found</h3>
                <p>Try another word or clear your filters.</p>
                <button
                  onClick={() => {
                    setQuery("");
                    setType("all");
                    setCategory("all");
                    setLocation("all");
                    setStatus("all");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
            {filtered.length > limit && (
              <button
                className="load-more secondary"
                onClick={() => setLimit(limit + 9)}
              >
                Show more items <ArrowRight size={16} />
              </button>
            )}
            {page === "home" && (
              <section className="how">
                <div>
                  <span className="eyebrow teal">
                    GOOD THINGS FIND THEIR WAY BACK
                  </span>
                  <h2>
                    One report. A little hope.
                    <br />A happy reunion.
                  </h2>
                </div>
                {[
                  [
                    "01",
                    "Share the details",
                    "Lost or found? Tell your campus what to look for.",
                  ],
                  [
                    "02",
                    "Make a connection",
                    "Spot your item and send private ownership details.",
                  ],
                  [
                    "03",
                    "Bring it home",
                    "An admin verifies your claim and arranges collection.",
                  ],
                ].map(([n, t, p]) => (
                  <article key={n}>
                    <span>{n}</span>
                    <h3>{t}</h3>
                    <p>{p}</p>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
        {page === "dashboard" && (
          <>
            <section className="section-title">
              <div>
                <span className="eyebrow teal">YOUR PERSONAL NOTICEBOARD</span>
                <h1 className="page-heading">My dashboard</h1>
                <p>Follow your reports and the journey back to you.</p>
              </div>
              <button
                className="primary"
                onClick={() => setForm({ type: "lost" })}
              >
                <Plus size={18} />
                New report
              </button>
            </section>
            <h2>My reports</h2>
            <div className="cards">
              {data.reports
                .filter((r) => r.reporterId === user.id)
                .map((r) => (
                  <div key={r.id}>
                    <ReportCard report={r} onClick={() => setSelected(r)} />
                    {r.status === "open" && (
                      <div className="row-actions">
                        <button
                          onClick={() => setForm({ type: r.type, report: r })}
                        >
                          Edit report
                        </button>
                        {r.type === "lost" && (
                          <button
                            disabled={busy}
                            onClick={() => run("close", { reportId: r.id })}
                          >
                            Close resolved report
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
            {!data.reports.some((r) => r.reporterId === user.id) && (
              <div className="empty">Your reports will appear here.</div>
            )}
            <h2 className="spaced">My claims</h2>
            {data.claims
              .filter((c) => c.claimantId === user.id)
              .map((c) => (
                <article className="claim-row" key={c.id}>
                  <div>
                    <h3>
                      {data.reports.find((r) => r.id === c.reportId)?.title ||
                        "Reported item"}
                    </h3>
                    <p>{c.evidence}</p>
                    {c.reason && (
                      <p className="private-note">
                        Decision reason: {c.reason}
                      </p>
                    )}
                    {c.collection && (
                      <p className="private-note">
                        <MapPin size={15} /> Collect at: {c.collection}
                      </p>
                    )}
                  </div>
                  <span className={`badge ${c.status}`}>{c.status}</span>
                </article>
              ))}
            {!data.claims.some((c) => c.claimantId === user.id) && (
              <div className="empty">
                No claims yet. Browse found items to get started.
              </div>
            )}
          </>
        )}
        {page === "admin" && user.admin && (
          <>
            <section className="section-title">
              <div>
                <span className="eyebrow teal">
                  VERIFIED RETURNS START HERE
                </span>
                <h1 className="page-heading">Administration</h1>
                <p>
                  Review private evidence, coordinate collection, and confirm
                  physical handover.
                </p>
              </div>
              <ShieldCheck size={36} />
            </section>
            <h2>Claims & collections</h2>
            {data.claims.map((c) => (
              <article className="claim-row" key={c.id}>
                <div>
                  <h3>
                    {data.reports.find((r) => r.id === c.reportId)?.title}
                  </h3>
                  <span className={`badge ${c.status}`}>{c.status}</span>
                  <p>
                    <b>Private evidence:</b> {c.evidence}
                  </p>
                  {c.reason && <p>Reason: {c.reason}</p>}
                  {c.collection && <p>Collection: {c.collection}</p>}
                  {c.status === "pending" && (
                    <form
                      className="decision-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        await run("decision", {
                          claimId: c.id,
                          action: (
                            e.nativeEvent as SubmitEvent
                          ).submitter?.getAttribute("value"),
                          reason: f.get("reason"),
                          collection: f.get("collection"),
                        });
                      }}
                    >
                      <label>
                        Collection location
                        <input
                          name="collection"
                          placeholder="Student services, desk 2"
                          maxLength={200}
                        />
                      </label>
                      <label>
                        Rejection reason (private)
                        <input
                          name="reason"
                          placeholder="Explain why evidence is insufficient"
                          maxLength={1000}
                        />
                      </label>
                      <div className="row-actions">
                        <button
                          className="primary"
                          name="action"
                          value="approve"
                          disabled={busy}
                        >
                          Approve collection
                        </button>
                        <button name="action" value="reject" disabled={busy}>
                          Reject claim
                        </button>
                      </div>
                    </form>
                  )}
                  {c.status === "approved" && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        run("decision", { claimId: c.id, action: "complete" })
                      }
                    >
                      Confirm physical handover <Check size={16} />
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!data.claims.length && (
              <div className="empty">No claims to review yet.</div>
            )}
            <h2 className="spaced">Moderate reports</h2>
            {data.reports.map((r) => (
              <div className="moderate" key={r.id}>
                <button className="text-button" onClick={() => setSelected(r)}>
                  {r.title}
                  <ChevronRight size={16} />
                </button>
                <span className="badge">{r.status}</span>
                {r.status === "open" && (
                  <button
                    disabled={busy}
                    onClick={() => run("close", { reportId: r.id })}
                  >
                    Close report
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </main>
      <footer>
        <a className="brand" href="#" onClick={() => navigate("home")}>
          <Package size={21} /> campus<span className="brand-light">find</span>
        </a>
        <p>A little care goes a long way. Made for our campus community.</p>
        <span>
          <ShieldCheck size={15} /> Verified campus access
        </span>
      </footer>
      {form && (
        <Modal
          title={
            form.report ? "Edit your report" : `Report a ${form.type} item`
          }
          onClose={() => setForm(null)}
        >
          <ReportForm
            initial={form}
            busy={busy}
            user={user}
            onSubmit={async (p) => {
              if (
                await run(form.report ? "edit" : "reports", {
                  ...p,
                  reportId: form.report?.id,
                })
              )
                setForm(null);
            }}
            onError={setError}
          />
        </Modal>
      )}
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <div className="detail-meta">
            <span className={`badge ${selected.type}`}>{selected.type}</span>
            <span className="badge">
              {data.reports.find((r) => r.id === selected.id)?.status}
            </span>
            <span>{selected.category}</span>
          </div>
          <Photo report={selected} />
          <p className="detail-description">{selected.description}</p>
          <p className="muted">
            <MapPin size={16} />
            {selected.location} · {selected.date}
          </p>
          {selected.type === "found" &&
            selected.reporterId !== user.id &&
            data.reports.find((r) => r.id === selected.id)?.status ===
              "open" && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  if (
                    await run("claim", {
                      reportId: selected.id,
                      evidence: f.get("evidence"),
                    })
                  )
                    setSelected(null);
                }}
              >
                <h3>Think this belongs to you?</h3>
                <p className="muted">
                  Share a unique detail only the owner would know. Only you and
                  administrators can view this evidence.
                </p>
                <label>
                  Private ownership evidence
                  <textarea
                    required
                    minLength={15}
                    maxLength={3000}
                    name="evidence"
                    placeholder="Describe identifying marks, contents, or a serial number…"
                  />
                </label>
                <button className="primary" disabled={busy}>
                  {busy ? "Submitting…" : "Submit ownership claim"}
                  <ArrowRight size={16} />
                </button>
              </form>
            )}
        </Modal>
      )}
    </>
  );
}
function ReportCard({
  report: r,
  onClick,
}: {
  report: Report;
  onClick: () => void;
}) {
  return (
    <button className="report-card" onClick={onClick}>
      <div className={`item-art ${r.category.replace(" ", "-")}`}>
        <span className={`badge ${r.type}`}>
          {r.type === "lost" ? "Lost item" : "Found item"}
        </span>
        {r.photo ? (
          <img src={r.photo} alt={r.title} />
        ) : (
          <span className="item-glyph" aria-hidden="true">
            {glyphs[r.category]}
          </span>
        )}
        <span className="art-caption">{r.category}</span>
      </div>
      <div className="card-content">
        <div className="card-category">
          {r.category}
          <span>{r.status !== "open" ? r.status : "● Open"}</span>
        </div>
        <h3>
          {r.title}
          <ArrowUpRight size={18} />
        </h3>
        <p>
          <MapPin size={14} />
          {r.location}
        </p>
        <div className="card-bottom">
          <span>
            <Clock size={13} />
            {new Date(r.date + "T12:00:00").toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            })}
          </span>
          <span>
            View details <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </button>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,textarea,select,a[href]",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", listener);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button autoFocus onClick={onClose} aria-label="Close dialog">
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Photo({ report }: { report: Report }) {
  const [url, setUrl] = useState(report.photo || ""),
    [error, setError] = useState("");
  useEffect(() => {
    if (!api.demo && report.photoKey)
      api
        .photoUrl(report.id)
        .then((r) => setUrl(r.url))
        .catch(() =>
          setError("Photo could not be loaded. Reopen the item to retry."),
        );
  }, [report.id]);
  return (
    <>
      {url && <img className="detail-photo" src={url} alt={report.title} />}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
function ReportForm({
  initial,
  busy,
  user,
  onSubmit,
  onError,
}: {
  initial: { type: string; report?: Report };
  busy: boolean;
  user: User;
  onSubmit: (p: any) => Promise<void>;
  onError: (s: string) => void;
}) {
  const [uploading, setUploading] = useState(false),
    [localError, setLocalError] = useState("");
  const r = initial.report;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setLocalError("");
        const f = new FormData(e.currentTarget);
        const p = Object.fromEntries(f.entries());
        setUploading(true);
        try {
          const file = f.get("photo") as File;
          const photo = file?.size ? await api.upload(file, user) : {};
          await onSubmit({ ...p, ...photo });
        } catch (e) {
          setLocalError((e as Error).message);
          onError((e as Error).message);
        } finally {
          setUploading(false);
        }
      }}
    >
      <p className="muted">
        Keep unique identifying details private so the owner can prove it’s
        theirs.
      </p>
      {localError && (
        <p className="error alert" role="alert">
          {localError}
        </p>
      )}
      <label>
        Item title
        <input
          name="title"
          defaultValue={r?.title}
          required
          minLength={3}
          maxLength={100}
          placeholder="e.g. Navy blue backpack"
        />
      </label>
      <div className="form-grid">
        <label>
          Report type
          <select name="type" defaultValue={r?.type || initial.type}>
            <option value="lost">Lost item</option>
            <option value="found">Found item</option>
          </select>
        </label>
        <label>
          Category
          <select name="category" defaultValue={r?.category}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Public description
        <textarea
          name="description"
          required
          minLength={10}
          maxLength={2000}
          defaultValue={r?.description}
          placeholder="Describe the item without revealing private details."
        />
      </label>
      <div className="form-grid">
        <label>
          Campus location
          <input
            name="location"
            required
            minLength={2}
            maxLength={100}
            defaultValue={r?.location}
            placeholder="Central Library"
          />
        </label>
        <label>
          Date lost / found
          <input
            name="date"
            type="date"
            required
            max={new Date().toISOString().slice(0, 10)}
            defaultValue={r?.date || new Date().toISOString().slice(0, 10)}
          />
        </label>
      </div>
      {!r && (
        <label className="upload-label">
          <Upload size={20} /> Optional photo · JPG, PNG, WebP · max 5 MB
          <input
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
        </label>
      )}
      <button className="primary" disabled={busy || uploading}>
        {busy || uploading
          ? "Saving report…"
          : r
            ? "Save changes"
            : "Publish report"}
        <ArrowUpRight size={17} />
      </button>
    </form>
  );
}
function Login({ onLogin }: { onLogin: () => Promise<void> }) {
  const [mode, setMode] = useState("login"),
    [email, setEmail] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div className="login-layout">
      <section className="login-story">
        <a className="brand">
          <Package /> campus<span className="brand-light">find</span>
        </a>
        <div>
          <span className="eyebrow">YOUR CAMPUS. YOUR COMMUNITY.</span>
          <h1>
            Good things
            <br />
            find their
            <br />
            <em>way back.</em>
          </h1>
          <p>
            From a missing set of keys to your favourite notebook.
            <br />
            Let’s help you find what matters.
          </p>
        </div>
        <span>
          <ShieldCheck size={18} /> A trusted space for our campus community
        </span>
      </section>
      <section className="login-panel">
        <span className="eyebrow teal">WELCOME TO CAMPUS FIND</span>
        <h2>
          {api.demo
            ? "Make yourself at home."
            : mode === "reset" || mode === "reset-confirm"
              ? "Recover your account."
              : mode === "register"
                ? "Join your campus."
                : mode === "verify"
                  ? "Check your inbox."
                  : "Welcome back."}
        </h2>
        <p className="muted">
          Lost something? Found something? You’re in the right place.
        </p>
        {api.demo ? (
          <>
            <div className="demo-notice">
              <b>Local demonstration mode</b>
              <p>
                Explore seeded reports and the full return workflow. These
                simulated sessions are for this browser only and provide no
                production security.
              </p>
            </div>
            <button
              className="primary wide"
              onClick={async () => {
                api.demoLogin(false);
                await onLogin();
              }}
            >
              Continue as student <ArrowRight size={18} />
            </button>
            <button
              className="secondary wide"
              onClick={async () => {
                api.demoLogin(true);
                await onLogin();
              }}
            >
              <ShieldCheck size={17} /> Explore administrator view
            </button>
            <small className="muted">
              Sample data persists in your browser between sessions.
            </small>
          </>
        ) : (
          <>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setBusy(true);
                setError("");
                try {
                  const email = String(f.get("email")).trim().toLowerCase();
                  if (
                    email.split("@")[1]?.toLowerCase() !==
                    api.domain.toLowerCase()
                  )
                    throw Error(`Use your @${api.domain} campus email`);
                  await api.auth(
                    mode,
                    email,
                    String(f.get("password") || ""),
                    String(f.get("code") || ""),
                  );
                  if (mode === "register") {
                    setMode("verify");
                    setMessage(
                      "Enter the verification code sent to your campus email.",
                    );
                  } else if (mode === "reset") {
                    setMode("reset-confirm");
                    setMessage(
                      "If an account exists, a password reset code has been sent to your verified email.",
                    );
                  } else if (mode === "reset-confirm") {
                    setMode("login");
                    setMessage(
                      "Password updated. Sign in with your new password.",
                    );
                  } else if (mode === "verify") {
                    setMode("login");
                    setMessage("Email verified. You can now sign in.");
                  } else await onLogin();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Campus email
                <input
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                  placeholder={`you@${api.domain}`}
                />
              </label>
              {(mode === "verify" || mode === "reset-confirm") && (
                <label>
                  Verification code
                  <input name="code" required autoComplete="one-time-code" />
                </label>
              )}
              {mode !== "verify" && mode !== "reset" && (
                <label>
                  {mode === "reset-confirm" ? "New password" : "Password"}
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={12}
                    autoComplete={
                      mode === "register" || mode === "reset-confirm"
                        ? "new-password"
                        : "current-password"
                    }
                  />
                </label>
              )}
              {error && (
                <p role="alert" className="error alert">
                  {error}
                </p>
              )}
              {message && <p role="status">{message}</p>}
              <button className="primary wide" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : mode === "reset"
                    ? "Send reset code"
                    : mode === "reset-confirm"
                      ? "Save new password"
                      : mode === "register"
                        ? "Create account"
                        : mode === "verify"
                          ? "Verify email"
                          : "Sign in"}
                <ArrowRight size={17} />
              </button>
            </form>
            <div className="row-actions">
              {["login", "register", "verify", "reset"]
                .filter((m) => m !== mode)
                .map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m);
                      setError("");
                    }}
                  >
                    {m === "login"
                      ? "Sign in"
                      : m === "register"
                        ? "Create account"
                        : m === "reset"
                          ? "Forgot password?"
                          : "Verify email"}
                  </button>
                ))}
            </div>
            {mode === "verify" && (
              <button
                className="text-button"
                disabled={busy || !email}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await api.auth("resend", email, "", "");
                    setMessage("A new verification code has been sent.");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Resend verification code
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
