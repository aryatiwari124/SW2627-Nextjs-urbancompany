"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Slot {
	time: string;
	start: string;
	end: string;
	status: "OPEN" | "BOOKED" | "HELD";
	booking?: {
		id?: number;
		service?: string;
		status?: string;
	};
}

interface Professional {
	id: number;
	name: string;
	phone: string | null;
}

interface CalendarResponse {
	professional: Professional;
	date: string;
	slots: Slot[];
	availableSlots: Slot[];
	bookedSlots: Slot[];
}

const defaultDates = [
	{ day: "Today", date: "26", month: "Aug", fullDate: "2026-08-26" },
	{ day: "Thu", date: "27", month: "Aug", fullDate: "2026-08-27" },
	{ day: "Fri", date: "28", month: "Aug", fullDate: "2026-08-28" },
	{ day: "Sat", date: "29", month: "Aug", fullDate: "2026-08-29" },
	{ day: "Sun", date: "30", month: "Aug", fullDate: "2026-08-30" },
];

export default function ProfessionalPage() {
	const router = useRouter();
	const [checkingAuth, setCheckingAuth] = useState(true);

	// Professional ID
	const [proId, setProId] = useState<number | null>(null);
	const [selectedDateObj, setSelectedDateObj] = useState(defaultDates[0]);

	// Calendar & Profile State
	const [calendarData, setCalendarData] = useState<CalendarResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Fetch calendar for selected professional & date
	const fetchCalendar = useCallback(async (targetId: number, targetDate?: string) => {
		const dateStr = targetDate || selectedDateObj.fullDate;
		try {
			setLoading(true);
			setError(null);

			const res = await fetch(`/api/professionals/${targetId}/calendar?date=${dateStr}`);
			if (res.status === 401) {
				router.push("/login?redirect=/professional");
				return;
			}
			if (!res.ok) {
				const errBody = await res.json().catch(() => ({}));
				throw new Error(errBody.error || `Failed to fetch calendar (HTTP ${res.status})`);
			}

			const data: CalendarResponse = await res.json();
			setCalendarData(data);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Failed to load professional calendar.");
		} finally {
			setLoading(false);
		}
	}, [selectedDateObj.fullDate, router]);

	// Check auth state on mount
	useEffect(() => {
		async function checkAuth() {
			try {
				const res = await fetch("/api/auth/me");
				if (res.status === 401) {
					router.push("/login?redirect=/professional");
					return;
				}
				const data = await res.json();
				if (data.user?.role === "CUSTOMER") {
					router.push("/customer");
					return;
				}

				// Check if there's a dev-override query param ?id=
				let idToUse = data.user?.professionalId;
				if (typeof window !== "undefined") {
					const params = new URLSearchParams(window.location.search);
					const idFromUrl = params.get("id");
					if (idFromUrl && !isNaN(Number(idFromUrl))) {
						idToUse = Number(idFromUrl);
					}
				}

				if (idToUse) {
					setProId(idToUse);
					fetchCalendar(idToUse, selectedDateObj.fullDate);
				} else {
					setError("No professional profile linked to this user account.");
				}
				setCheckingAuth(false);
			} catch {
				router.push("/login?redirect=/professional");
			}
		}
		checkAuth();
	}, [router, fetchCalendar, selectedDateObj.fullDate]);

	const handleLogout = async () => {
		try {
			await fetch("/api/auth/logout", { method: "POST" });
			router.push("/login");
		} catch {
			router.push("/login");
		}
	};

	const handleDateChange = (dateObj: (typeof defaultDates)[0]) => {
		setSelectedDateObj(dateObj);
		if (proId) {
			fetchCalendar(proId, dateObj.fullDate);
		}
	};

	if (checkingAuth && !calendarData) {
		return (
			<main className="uc-page">
				<nav className="uc-topbar">
					<Link className="uc-brand" href="/professional" aria-label="Urban Company Partner Home">
						<span className="uc-brand-mark">U</span>
						<span>urban company <span className="uc-badge uc-badge-partner">PARTNER</span></span>
					</Link>
				</nav>
				<section className="uc-container">
					<div className="uc-hero">
						<div>
							<p className="uc-eyebrow">Loading schedule</p>
							<h1 className="uc-hero-title">Preparing your <em>calendar</em>...</h1>
							<div className="uc-skeleton uc-skeleton-text" style={{ width: 280, height: 16 }} />
						</div>
					</div>
					<div className="uc-two-col">
						<div>
							<div className="uc-skeleton" style={{ height: 120, marginBottom: 16 }} />
							<div className="uc-skeleton" style={{ height: 80, marginBottom: 10 }} />
							<div className="uc-skeleton" style={{ height: 80, marginBottom: 10 }} />
							<div className="uc-skeleton" style={{ height: 80 }} />
						</div>
						<div>
							<div className="uc-skeleton" style={{ height: 160, marginBottom: 16 }} />
							<div className="uc-skeleton" style={{ height: 140 }} />
						</div>
					</div>
				</section>
			</main>
		);
	}

	const professional = calendarData?.professional;
	const slots = calendarData?.slots || [];
	const bookedSlots = calendarData?.bookedSlots || [];
	const availableSlots = calendarData?.availableSlots || [];

	const proInitials = professional?.name
		? professional.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
		: "PR";

	return (
		<main className="uc-page">
			{/* Topbar */}
			<nav className="uc-topbar">
				<Link className="uc-brand" href="/professional" aria-label="Urban Company Partner Home">
					<span className="uc-brand-mark">U</span>
					<span>urban company <span className="uc-badge uc-badge-partner">PARTNER</span></span>
				</Link>
				<div className="uc-nav-actions">
					<span className="uc-location-tag">
						<span className="uc-live-dot" /> Bengaluru Partner Hub
					</span>
					<div className="uc-avatar-btn" title={`${professional?.name} (${professional?.phone})`}>
						{proInitials}
					</div>
					<button
						onClick={handleLogout}
						type="button"
						className="uc-logout-btn"
					>
						Sign out
					</button>
				</div>
			</nav>

			{/* Welcome banner */}
			<section className="uc-container">
				<div className="uc-hero">
					<div>
						<p className="uc-eyebrow">Professional Portal</p>
						<h1 className="uc-hero-title">
							Hello, {professional?.name || "Professional"}
							<span>.</span>
						</h1>
						<p className="uc-hero-copy">
							Here is your live schedule and slot availability. Stay on top of your bookings.
						</p>
					</div>
					<div className="uc-trust-note">
						<span className="uc-live-dot" /> {availableSlots.length} open slots on {selectedDateObj.date} {selectedDateObj.month}
					</div>
				</div>

				{/* Main schedule layout */}
				<div className="uc-two-col">
					{/* Primary column: Day View Calendar */}
					<div>
						<div className="uc-section-heading">
							<div>
								<p className="uc-eyebrow">Calendar</p>
								<h2 className="uc-section-title">Day View Schedule</h2>
							</div>
							<div className="uc-stat-pill-group">
								<span className="uc-stat-pill booked">● {bookedSlots.length} Booked</span>
								<span className="uc-stat-pill open">○ {availableSlots.length} Available</span>
							</div>
						</div>

						{/* Date selector */}
						<div className="uc-date-panel">
							<div className="uc-panel-header">
								<div>
									<h3 className="uc-panel-title">Select Date</h3>
									<p className="uc-panel-sub">
										Viewing schedule for {selectedDateObj.day}, {selectedDateObj.date} {selectedDateObj.month} 2026
									</p>
								</div>
								<button
									className="uc-btn-secondary"
									type="button"
									onClick={() => proId && fetchCalendar(proId, selectedDateObj.fullDate)}
								>
									↻ Refresh
								</button>
							</div>

							<div className="uc-date-row" role="group" aria-label="Select a date">
								{defaultDates.map((dateItem) => (
									<button
										key={dateItem.fullDate}
										className={`uc-date-btn${selectedDateObj.fullDate === dateItem.fullDate ? " selected" : ""}`}
										onClick={() => handleDateChange(dateItem)}
										type="button"
									>
										<span>{dateItem.day}</span>
										<strong>{dateItem.date}</strong>
										<small>{dateItem.month}</small>
									</button>
								))}
							</div>
						</div>

						{/* Loading and Error states */}
						{loading && (
							<div className="uc-status-box">
								<p style={{ margin: 0 }}>Loading schedule for {selectedDateObj.date} {selectedDateObj.month}...</p>
							</div>
						)}

						{error && !loading && (
							<div className="uc-status-box error">
								<p style={{ margin: 0 }}>⚠ {error}</p>
								<button
									className="uc-btn-outline"
									type="button"
									style={{ marginTop: 10 }}
									onClick={() => proId && fetchCalendar(proId, selectedDateObj.fullDate)}
								>
									Retry
								</button>
							</div>
						)}

						{/* Slot cards */}
						{!loading && !error && (
							<div className="uc-slots-list">
								{slots.map((slot) => {
									const isBooked = slot.status === "BOOKED" || slot.status === "HELD";
									return (
										<article
											key={slot.time}
											className={`uc-slot-card ${isBooked ? "booked" : "open"}`}
										>
											<div className="uc-slot-time-col">
												<span className="uc-slot-time">{slot.time}</span>
												<span className="uc-slot-duration">2.5 hrs</span>
											</div>

											<div className="uc-slot-info-col">
												{isBooked ? (
													<div>
														<div className="uc-slot-topline">
															<span className="uc-slot-pill booked">
																{slot.status === "HELD" ? "HELD (CHECKOUT)" : "BOOKED"}
															</span>
															{slot.booking?.id && (
																<span className="uc-booking-ref">Booking #{slot.booking.id}</span>
															)}
														</div>
														<h3 className="uc-slot-service-title">
															{slot.booking?.service || "Service Appointment"}
														</h3>
														<p className="uc-slot-service-desc">
															Status: <strong>{slot.booking?.status || "CONFIRMED"}</strong> • Customer confirmed
														</p>
													</div>
												) : (
													<div>
														<span className="uc-slot-pill open">OPEN FOR BOOKING</span>
														<h3 className="uc-slot-avail-title">Available Slot</h3>
														<p className="uc-slot-avail-desc">No bookings scheduled. Customers can book this time.</p>
													</div>
												)}
											</div>

											<div className="uc-slot-action-col">
												<span className={`uc-slot-status ${isBooked ? "booked" : "open"}`}>
													{isBooked ? "🔒 Confirmed" : "✓ Open"}
												</span>
											</div>
										</article>
									);
								})}
							</div>
						)}
					</div>

					{/* Side column: Today's Bookings Summary */}
					<aside>
						<div className="uc-side-heading">
							<h2 className="uc-section-title">Selected Day's Bookings</h2>
							<span className="uc-count-badge">{bookedSlots.length} Bookings</span>
						</div>

						{bookedSlots.length === 0 ? (
							<div className="uc-empty-state">
								<div className="uc-empty-icon">✓</div>
								<h3 className="uc-empty-title">No Bookings</h3>
								<p className="uc-empty-desc">You have no appointments booked for {selectedDateObj.date} {selectedDateObj.month}.</p>
							</div>
						) : (
							bookedSlots.map((slot, idx) => (
								<article key={idx} className="uc-booked-card">
									<div className="uc-booked-icon">✦</div>
									<div className="uc-booked-details">
										<div className="uc-booked-time-row">
											<span className="uc-booked-time">{slot.time}</span>
											<span className="uc-booked-confirmed">{slot.status}</span>
										</div>
										<h3 className="uc-booked-title">{slot.booking?.service || "Service Booking"}</h3>
										<p className="uc-booked-meta">Ref #{slot.booking?.id || "N/A"} • 2.5 hrs duration</p>
									</div>
								</article>
							))
						)}

						{/* Professional info card */}
						<div className="uc-pro-info-card">
							<div className="uc-pro-avatar-row">
								<div className="uc-pro-avatar">{proInitials}</div>
								<div className="uc-pro-avatar-info">
									<strong>{professional?.name || "Professional"}</strong>
									<p>Verified Urban Company Professional</p>
								</div>
							</div>
							<div className="uc-pro-info-meta">
								<div>
									<small>Phone</small>
									<p>{professional?.phone || "Not on file"}</p>
								</div>
								<div>
									<small>Rating</small>
									<p>★ 4.9 (Top Rated)</p>
								</div>
							</div>
						</div>

						{/* Support banner */}
						<div className="uc-help-banner">
							<span className="uc-help-icon">?</span>
							<div>
								<strong className="uc-help-title">Need to block time?</strong>
								<p className="uc-help-sub">Contact partner support to manage leave</p>
							</div>
							<span className="uc-help-arrow" aria-hidden="true">↗</span>
						</div>
					</aside>
				</div>
			</section>

			{/* Footer */}
			<footer className="uc-footer">
				<span className="uc-footer-brand">Urban Company Partner Portal</span>
				<span>Empowering professionals with real-time scheduling.</span>
				<span>© 2026 Urban Company</span>
			</footer>
		</main>
	);
}
