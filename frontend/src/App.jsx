import "./App.css";
import { useEffect, useState } from "react";
import {
    BookOpen, CalendarDays, LayoutDashboard,
    LogOut, MapPin, Search, ShieldCheck,
    Clock, X, CheckCircle2, Armchair,
    RefreshCw, Users, Plus
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import api from "./services/api";

const moneyFree = value => String(value ?? "");

function App() {
    const [zoneForm, setZoneForm] = useState({
        name: "",
        floor: "",
        description: ""
    });

    const [seatForm, setSeatForm] = useState({
        zoneId: "",
        seatNumber: "",
        seatType: "standard"
    });

    const [user, setUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("smartseat_user"));
        } catch {
            return null;
        }
    });

    const [page, setPage] = useState("dashboard");
    const [zones, setZones] = useState([]);
    const [seats, setSeats] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [overview, setOverview] = useState(null);
    const [selectedZone, setSelectedZone] = useState("");
    const [selectedSeat, setSelectedSeat] = useState(null);
    const [date, setDate] = useState(
        new Date().toLocaleDateString("en-CA")
    );
    const [startTime, setStartTime] = useState("10:00");
    const [endTime, setEndTime] = useState("11:00");
    const [token, setToken] = useState("");
    const [authMode, setAuthMode] = useState("login");
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: ""
    });
    const [notice, setNotice] = useState("");
    const [loading, setLoading] = useState(false);

    const notify = message => {
        setNotice(message);
        window.setTimeout(() => setNotice(""), 3500);
    };

    async function createZone(event) {
        event.preventDefault();

        try {
            await api.post("/library/zones", zoneForm);
            setZoneForm({ name: "", floor: "", description: "" });
            await loadLibrary();
            notify("Library zone created");
        } catch (error) {
            notify(error.response?.data?.error || "Unable to create zone");
        }
    }

    async function createSeat(event) {
        event.preventDefault();

        try {
            await api.post("/library/seats", {
                ...seatForm,
                zoneId: Number(seatForm.zoneId)
            });

            setSeatForm({
                zoneId: "",
                seatNumber: "",
                seatType: "standard"
            });

            await loadLibrary();
            await loadSeats();
            notify("Seat created");
        } catch (error) {
            notify(error.response?.data?.error || "Unable to create seat");
        }
    }

    async function loadLibrary() {
        const [zoneResponse, bookingResponse] = await Promise.all([
            api.get("/library/zones"),
            api.get("/bookings/mine")
        ]);

        setZones(zoneResponse.data.zones);
        setBookings(bookingResponse.data.bookings);

        if (!selectedZone && zoneResponse.data.zones.length) {
            setSelectedZone(String(zoneResponse.data.zones[0].id));
        }
    }

    async function loadSeats() {
        if (!date || !startTime || !endTime) return;

        const start = new Date(`${date}T${startTime}:00+05:30`);
        const end = new Date(`${date}T${endTime}:00+05:30`);

        const response = await api.get("/library/seats", {
            params: {
                date,
                start: start.toISOString(),
                end: end.toISOString(),
                zoneId: selectedZone || undefined
            }
        });

        setSeats(response.data.seats);
    }

    async function loadAdmin() {
        const response = await api.get("/bookings/admin/overview");
        setOverview(response.data);
    }

    useEffect(() => {
        if (!user) return;

        loadLibrary().catch(() => notify("Unable to load library data"));
    }, [user]);

    useEffect(() => {
        if (!user) return;

        loadSeats().catch(() => notify("Unable to load seat availability"));
    }, [user, date, startTime, endTime, selectedZone]);

    useEffect(() => {
        if (user?.role === "admin" && page === "admin") {
            loadAdmin().catch(() => notify("Admin access required"));
        }
    }, [page, user]);

    async function authenticateUser(event) {
        event.preventDefault();
        setLoading(true);

        try {
            const endpoint = authMode === "login"
                ? "/auth/login"
                : "/auth/register";

            const response = await api.post(endpoint, form);
            const { token, user } = response.data;

            localStorage.setItem("smartseat_token", token);
            localStorage.setItem("smartseat_user", JSON.stringify(user));

            setUser(user);
            notify(`Welcome, ${user.name}`);
        } catch (error) {
            notify(error.response?.data?.error || "Authentication failed");
        } finally {
            setLoading(false);
        }
    }

    function logout() {
        localStorage.removeItem("smartseat_token");
        localStorage.removeItem("smartseat_user");
        setUser(null);
        setPage("dashboard");
        setSeats([]);
        setBookings([]);
    }

    async function createBooking() {
        if (!selectedSeat) return notify("Select a seat first");

        setLoading(true);

        try {
            const start = new Date(`${date}T${startTime}:00+05:30`);
            const end = new Date(`${date}T${endTime}:00+05:30`);

            const response = await api.post("/bookings", {
                seatId: selectedSeat.id,
                startTime: start.toISOString(),
                endTime: end.toISOString()
            });

            setToken(response.data.checkinToken);
            setSelectedSeat(null);

            await loadLibrary();
            await loadSeats();

            notify("Seat reserved successfully");
        } catch (error) {
            notify(error.response?.data?.error || "Booking failed");
            await loadSeats().catch(() => { });
        } finally {
            setLoading(false);
        }
    }

    async function cancelBooking(id) {
        try {
            await api.post(`/bookings/${id}/cancel`);
            await loadLibrary();
            await loadSeats();
            notify("Booking cancelled");
        } catch (error) {
            notify(error.response?.data?.error || "Cancellation failed");
        }
    }

    async function checkIn(booking) {
        const input = window.prompt("Enter your secure check-in token:");

        if (!input) return;

        try {
            await api.post(`/bookings/${booking.id}/checkin`, {
                token: input.trim()
            });

            await loadLibrary();
            await loadSeats();
            notify("Check-in successful");
        } catch (error) {
            notify(error.response?.data?.error || "Check-in failed");
        }
    }

    if (!user) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <div className="brand-mark">
                        <Armchair size={30} />
                    </div>

                    <p className="eyebrow">TIET LIBRARY SERVICES</p>
                    <h1>SmartSeat<span>.</span></h1>
                    <p className="muted">
                        Find your space. Reserve your focus.
                    </p>

                    <form onSubmit={authenticateUser}>
                        {authMode === "register" && (
                            <label>
                                Full name
                                <input
                                    required
                                    minLength="2"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="Your name"
                                />
                            </label>
                        )}

                        <label>
                            Email address
                            <input
                                required
                                type="email"
                                value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                placeholder="student@example.com"
                            />
                        </label>

                        <label>
                            Password
                            <input
                                required
                                type="password"
                                minLength="10"
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                placeholder="At least 10 characters"
                            />
                        </label>

                        <button className="primary-btn full" disabled={loading}>
                            {loading ? "Please wait..." :
                                authMode === "login" ? "Sign in" : "Create account"}
                        </button>
                    </form>

                    <button className="text-btn" onClick={() => {
                        setAuthMode(authMode === "login" ? "register" : "login");
                    }}>
                        {authMode === "login"
                            ? "New here? Create an account"
                            : "Already registered? Sign in"}
                    </button>
                </div>
            </div>
        );
    }

    const availableCount = seats.filter(s => s.available).length;

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="brand">
                    <div className="brand-mark"><Armchair size={24} /></div>
                    <div>
                        <strong>SmartSeat</strong>
                        <small>TIET LIBRARY</small>
                    </div>
                </div>

                <p className="nav-label">WORKSPACE</p>

                <button
                    className={page === "dashboard" ? "nav active" : "nav"}
                    onClick={() => setPage("dashboard")}
                >
                    <LayoutDashboard size={18} /> Overview
                </button>

                <button
                    className={page === "library" ? "nav active" : "nav"}
                    onClick={() => setPage("library")}
                >
                    <MapPin size={18} /> Find a seat
                </button>

                <button
                    className={page === "bookings" ? "nav active" : "nav"}
                    onClick={() => setPage("bookings")}
                >
                    <CalendarDays size={18} /> My bookings
                </button>

                {user.role === "admin" && (
                    <button
                        className={page === "admin" ? "nav active" : "nav"}
                        onClick={() => setPage("admin")}
                    >
                        <ShieldCheck size={18} /> Administration
                    </button>
                )}

                <div className="sidebar-bottom">
                    <div className="user-card">
                        <div className="avatar">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-info">
                            <strong>{user.name}</strong>
                            <small>{user.role}</small>
                        </div>
                        <button className="icon-btn" onClick={logout} aria-label="Sign out">
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </aside>

            <main className="main-content">
                <header className="topbar">
                    <div>
                        <p className="eyebrow">SMART LIBRARY MANAGEMENT</p>
                        <h2>
                            {page === "dashboard" ? "Your study space" :
                                page === "library" ? "Find a seat" :
                                    page === "bookings" ? "My reservations" : "Admin overview"}
                        </h2>
                    </div>

                    <button className="icon-btn" onClick={() => {
                        loadLibrary().then(loadSeats).catch(() => notify("Refresh failed"));
                    }} aria-label="Refresh data">
                        <RefreshCw size={19} />
                    </button>
                </header>

                {page === "dashboard" && (
                    <>
                        <section className="welcome-banner">
                            <div>
                                <p className="eyebrow">YOUR LIBRARY, SIMPLIFIED</p>
                                <h1>Make room for focus.</h1>
                                <p>Find and reserve your next study spot.</p>
                                <button className="primary-btn" onClick={() => setPage("library")}>
                                    Explore seats <Search size={16} />
                                </button>
                            </div>
                            <BookOpen className="banner-icon" size={100} />
                        </section>

                        <section className="stats-grid">
                            <Stat title="Library zones" value={zones.length} icon={<MapPin />} />
                            <Stat title="Seats displayed" value={seats.length} icon={<Armchair />} />
                            <Stat title="Available now" value={availableCount} icon={<CheckCircle2 />} />
                            <Stat title="My bookings" value={bookings.filter(b =>
                                ["reserved", "checked_in"].includes(b.status)).length
                            } icon={<CalendarDays />} />
                        </section>

                        <section className="section-heading">
                            <div>
                                <h3>Explore study areas</h3>
                                <p>Choose an area to find your preferred seat.</p>
                            </div>
                            <button className="text-btn" onClick={() => setPage("library")}>
                                View all
                            </button>
                        </section>

                        <div className="zone-grid">
                            {zones.map(zone => (
                                <button className="zone-card" key={zone.id} onClick={() => {
                                    setSelectedZone(String(zone.id));
                                    setPage("library");
                                }}>
                                    <div className="zone-icon"><BookOpen /></div>
                                    <h3>{zone.name}</h3>
                                    <p>{zone.floor}</p>
                                    <small>{zone.total_seats} seats</small>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {page === "library" && (
                    <>
                        <div className="filter-card">
                            <label>
                                Study area
                                <select value={selectedZone} onChange={e => setSelectedZone(e.target.value)}>
                                    {zones.map(z => (
                                        <option key={z.id} value={z.id}>{z.name} · {z.floor}</option>
                                    ))}
                                </select>
                            </label>

                            <label>
                                Date
                                <input type="date" min={new Date().toLocaleDateString("en-CA")}
                                    value={date} onChange={e => setDate(e.target.value)} />
                            </label>

                            <label>
                                Start time
                                <input type="time" value={startTime}
                                    onChange={e => setStartTime(e.target.value)} />
                            </label>

                            <label>
                                End time
                                <input type="time" value={endTime}
                                    onChange={e => setEndTime(e.target.value)} />
                            </label>
                        </div>

                        <div className="section-heading">
                            <div>
                                <h3>Available seats</h3>
                                <p>{availableCount} of {seats.length} seats available for this period</p>
                            </div>
                            <button className="text-btn" onClick={loadSeats}>
                                <RefreshCw size={15} /> Refresh
                            </button>
                        </div>

                        <div className="legend">
                            <span><i className="dot available" /> Available</span>
                            <span><i className="dot unavailable" /> Reserved</span>
                            <span><i className="dot selected" /> Selected</span>
                        </div>

                        <div className="seat-grid">
                            {seats.map(seat => (
                                <button
                                    key={seat.id}
                                    disabled={!seat.available}
                                    className={`seat ${!seat.available ? "unavailable" :
                                        selectedSeat?.id === seat.id ? "selected" : "available"
                                        }`}
                                    onClick={() => setSelectedSeat(seat)}
                                    aria-label={`Seat ${seat.seat_number}, ${seat.available ? "available" : "reserved"
                                        }`}
                                >
                                    <Armchair size={22} />
                                    <strong>{seat.seat_number}</strong>
                                    <small>{seat.seat_type}</small>
                                </button>
                            ))}
                        </div>

                        {selectedSeat && (
                            <div className="booking-panel">
                                <div>
                                    <p className="eyebrow">SELECTED SEAT</p>
                                    <h3>{selectedSeat.seat_number}</h3>
                                    <p>{selectedSeat.zone_name} · {selectedSeat.floor}</p>
                                    <p>{date} · {startTime} to {endTime}</p>
                                </div>
                                <button className="primary-btn" disabled={loading} onClick={createBooking}>
                                    {loading ? "Booking..." : "Reserve seat"}
                                </button>
                                <button className="icon-btn" aria-label="Close selection"
                                    onClick={() => setSelectedSeat(null)}>
                                    <X />
                                </button>
                            </div>
                        )}
                    </>
                )}

                {page === "bookings" && (
                    <>
                        <section className="section-heading">
                            <div>
                                <h3>Your bookings</h3>
                                <p>Manage your upcoming library sessions.</p>
                            </div>
                        </section>

                        <div className="booking-list">
                            {bookings.length === 0 && <Empty text="No bookings yet. Reserve your first seat." />}

                            {bookings.map(booking => (
                                <article className="booking-card" key={booking.id}>
                                    <div className="zone-icon"><Armchair /></div>
                                    <div className="booking-details">
                                        <h3>{booking.seat_number} · {booking.zone_name}</h3>
                                        <p>{booking.floor}</p>
                                        <small>{new Date(booking.start_time).toLocaleString()} –
                                            {" "}{new Date(booking.end_time).toLocaleTimeString()}</small>
                                    </div>
                                    <span className={`status ${booking.status}`}>
                                        {booking.status.replace("_", " ")}
                                    </span>
                                    {booking.status === "reserved" && (
                                        <div className="booking-actions">
                                            <button className="secondary-btn" onClick={() => checkIn(booking)}>
                                                Check in
                                            </button>
                                            <button className="danger-btn" onClick={() => cancelBooking(booking.id)}>
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    </>
                )}

                {page === "admin" && user.role === "admin" && (
                    <>
                        <div className="stats-grid">
                            <Stat title="Total seats" value={overview?.overview?.total_seats ?? 0} icon={<Armchair />} />
                            <Stat title="Active seats" value={overview?.overview?.active_seats ?? 0} icon={<CheckCircle2 />} />
                            <Stat title="Today's reservations" value={overview?.today?.reservations ?? 0} icon={<CalendarDays />} />
                            <Stat title="Checked in" value={overview?.today?.checked_in ?? 0} icon={<Users />} />
                        </div>

                        <div className="admin-note">
                            <ShieldCheck size={24} />
                            <div>
                                <h3>Administrator access</h3>
                                <p>Seat and zone creation is available through the protected API.
                                    Only verified administrator accounts can access these endpoints.</p>
                            </div>
                        </div>
                    </>
                )}
            </main>

            {notice && <div className="toast" role="status">{notice}</div>}

            {token && (
                <div className="modal-backdrop" role="presentation" onClick={() => setToken("")}>
                    <div className="modal" role="dialog" aria-modal="true"
                        aria-labelledby="token-title" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" aria-label="Close" onClick={() => setToken("")}>
                            <X />
                        </button>
                        <div className="success-icon"><CheckCircle2 size={34} /></div>
                        <h2 id="token-title">Seat reserved!</h2>
                        <p>Keep this check-in token private. It is required to verify your reservation.</p>
                        <QRCodeSVG value={token} size={170} level="M" />
                        <code className="token-text">{token}</code>
                        <button className="primary-btn full" onClick={() => {
                            navigator.clipboard.writeText(token);
                            notify("Check-in token copied");
                        }}>Copy check-in token</button>
                    </div>
                </div>
            )}
        </div>
    );
}

function Stat({ title, value, icon }) {
    return (
        <article className="stat-card">
            <div className="stat-icon">{icon}</div>
            <p>{title}</p>
            <strong>{value}</strong>
        </article>
    );
}

function Empty({ text }) {
    return <div className="empty-state"><Armchair size={34} /><p>{text}</p></div>;
}

export default App;
