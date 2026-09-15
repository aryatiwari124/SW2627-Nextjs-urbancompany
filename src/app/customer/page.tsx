"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Customer {
	id: number;
	name: string;
	phone: string | null;
	email: string;
	address: string | null;
}

interface Booking {
	id: number;
	service: string;
	professionalId: number;
	professional: string;
	bookingDate: string;
	status: string;
}

interface CustomerResponse {
	customer: Customer;
	bookings: Booking[];
}

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

interface CalendarResponse {
	professional: {
		id: number;
		name: string;
		phone: string | null;
	};
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

export default function CustomerPage() {
	const router = useRouter();
	const [checkingAuth, setCheckingAuth] = useState(true);

	// Customer data
	const [customerData, setCustomerData] = useState<CustomerResponse | null>(null);
	const [loadingCustomer, setLoadingCustomer] = useState(true);
	const [customerError, setCustomerError] = useState("");

	// Selected re-booking target
	const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

	// Date and time slot selection
	const [selectedDateObj, setSelectedDateObj] = useState(defaultDates[0]);
	const [slots, setSlots] = useState<Slot[]>([]);
	const [selectedTime, setSelectedTime] = useState<string>("");
	const [loadingSlots, setLoadingSlots] = useState(false);

	// Submission state
	const [submitting, setSubmitting] = useState(false);
	const [rebookSuccess, setRebookSuccess] = useState<string | null>(null);
	const [rebookError, setRebookError] = useState<string | null>(null);

	// Fetch customer profile & booking history
	const fetchCustomerData = useCallback(async () => {
		try {
			setLoadingCustomer(true);
			setCustomerError("");
			const res = await fetch(`/api/customer`);
			if (res.status === 401) {
				router.push("/login?redirect=/customer");
				return;
			}
			if (res.status === 403) {
				router.push("/professional");
				return;
			}
			if (!res.ok) {
				const errBody = await res.json().catch(() => ({}));
				throw new Error(errBody.error || `Failed to fetch customer (HTTP ${res.status})`);
			}
			const data: CustomerResponse = await res.json();
			setCustomerData(data);

			// Automatically select the first completed booking for rebooking if none selected
			const completed = data.bookings.find((b) => b.status === "COMPLETED");
			if (completed) {
				setSelectedBooking((prev) => prev ?? completed);
			}
		} catch (err: unknown) {
			setCustomerError(err instanceof Error ? err.message : "Failed to load customer profile.");
		} finally {
			setLoadingCustomer(false);
		}
	}, [router]);

	// Check auth state on mount
	useEffect(() => {
		async function checkAuth() {
			try {
				const res = await fetch("/api/auth/me");
				if (res.status === 401) {
					router.push("/login?redirect=/customer");
					return;
				}
				const data = await res.json();
				if (data.user?.role === "PROFESSIONAL") {
					router.push("/professional");
					return;
				}
				setCheckingAuth(false);
				fetchCustomerData();
			} catch {
				router.push("/login?redirect=/customer");
			}
		}
		checkAuth();
	}, [router, fetchCustomerData]);

	const handleLogout = async () => {
		try {
			await fetch("/api/auth/logout", { method: "POST" });
			router.push("/login");
		} catch {
			router.push("/login");
		}
	};

	// Fetch professional availability when target booking or date changes
	const fetchCalendarSlots = useCallback(async (proId: number, dateStr: string) => {
		try {
			setLoadingSlots(true);
			const res = await fetch(`/api/professionals/${proId}/calendar?date=${dateStr}`);
			if (!res.ok) {
				const errBody = await res.json().catch(() => ({}));
				throw new Error(errBody.error || `Failed to fetch calendar (HTTP ${res.status})`);
			}
			const calData: CalendarResponse = await res.json();
			setSlots(calData.slots);

			// Pick first available slot if currently selected slot is not open
			const openSlots = calData.slots.filter((s) => s.status === "OPEN");
			setSelectedTime((prev) => {
				const isCurrentOpen = openSlots.some((s) => s.time === prev);
				if (isCurrentOpen) return prev;
				return openSlots.length > 0 ? openSlots[0].time : "";
			});
		} catch {
			setSlots([]);
			setSelectedTime("");
		} finally {
			setLoadingSlots(false);
		}
	}, []);

	useEffect(() => {
		if (selectedBooking) {
			fetchCalendarSlots(selectedBooking.professionalId, selectedDateObj.fullDate);
		}
	}, [selectedBooking, selectedDateObj, fetchCalendarSlots]);

	// Handle re-booking submission
	const handleRebook = async () => {
		if (!selectedBooking) {
			setRebookError("Please select a past completed booking to re-book.");
			return;
		}
		if (!selectedTime) {
			setRebookError("Please select an available time slot.");
			return;
		}

		try {
			setSubmitting(true);
			setRebookError(null);
			setRebookSuccess(null);

			const res = await fetch(`/api/bookings/${selectedBooking.id}/rebook`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					date: selectedDateObj.fullDate,
					time: selectedTime,
				}),
			});

			const data = await res.json();

			if (res.status === 201) {
				setRebookSuccess(
					`Booking confirmed! ${selectedBooking.service} with ${selectedBooking.professional} on ${selectedDateObj.date} ${selectedDateObj.month} at ${selectedTime}.`
				);
				await fetchCalendarSlots(selectedBooking.professionalId, selectedDateObj.fullDate);
				await fetchCustomerData();
			} else if (res.status === 409) {
				setRebookError(data.error || "That time slot is no longer available. Please select another open slot.");
				await fetchCalendarSlots(selectedBooking.professionalId, selectedDateObj.fullDate);
			} else if (res.status === 404) {
				setRebookError("Booking record not found. Please refresh your past bookings.");
			} else if (res.status === 403) {
				setRebookError("You do not have permission to re-book this appointment.");
			} else if (res.status === 400) {
				setRebookError(data.error || "Invalid booking details provided.");
			} else {
				setRebookError(data.error || `Failed to re-book appointment (HTTP ${res.status})`);
			}
		} catch (err: unknown) {
			setRebookError(err instanceof Error ? err.message : "Network error while submitting booking.");
		} finally {
			setSubmitting(false);
		}
	};

	if ((checkingAuth || loadingCustomer) && !customerData) {
		return (
			<main className="uc-page">
				<nav className="uc-topbar">
					<Link className="uc-brand" href="/customer" aria-label="Urban Company home">
						<span className="uc-brand-mark">U</span><span>urban company</span>
					</Link>
				</nav>
				<section className="uc-container">
					<div className="uc-hero">
						<div>
							<p className="uc-eyebrow">Loading dashboard</p>
							<h1 className="uc-hero-title">Preparing your <em>account</em>...</h1>
							<div className="uc-skeleton uc-skeleton-text" style={{ width: 280, height: 16 }} />
						</div>
					</div>
					<div className="uc-two-col">
						<div>
							<div className="uc-skeleton" style={{ height: 140, marginBottom: 16 }} />
							<div className="uc-skeleton" style={{ height: 260 }} />
						</div>
						<div>
							<div className="uc-skeleton" style={{ height: 100, marginBottom: 12 }} />
							<div className="uc-skeleton" style={{ height: 100, marginBottom: 12 }} />
							<div className="uc-skeleton" style={{ height: 100 }} />
						</div>
					</div>
				</section>
			</main>
		);
	}

	if (customerError && !customerData) {
		return (
			<main className="uc-page">
				<nav className="uc-topbar">
					<Link className="uc-brand" href="/customer" aria-label="Urban Company home">
						<span className="uc-brand-mark">U</span><span>urban company</span>
					</Link>
				</nav>
				<section className="uc-container">
					<div className="uc-hero">
						<div>
							<p className="uc-eyebrow">Error</p>
							<h1 className="uc-hero-title">Unable to load dashboard<span>.</span></h1>
							<p className="uc-hero-copy">{customerError}</p>
							<button className="uc-btn-outline" onClick={() => fetchCustomerData()} style={{ marginTop: 16 }}>
								Retry
							</button>
						</div>
					</div>
				</section>
			</main>
		);
	}

	const customer = customerData?.customer;
	const bookings = customerData?.bookings || [];
	const customerInitials = customer?.name
		? customer.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
		: "UC";
	const customerFirstName = customer?.name ? customer.name.split(" ")[0] : "Customer";

	return (
		<main className="uc-page">
			<nav className="uc-topbar">
				<Link className="uc-brand" href="/customer" aria-label="Urban Company home">
					<span className="uc-brand-mark">U</span><span>urban company</span>
				</Link>
				<div className="uc-nav-actions">
					<span className="uc-location-tag">
						<span style={{ color: "var(--uc-coral)", marginRight: 4 }}>⌖</span> Bengaluru
					</span>
					<div className="uc-avatar-btn" title={`${customer?.name} (${customer?.email})`}>
						{customerInitials}
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

			<section className="uc-container">
				<div className="uc-hero">
					<div>
						<p className="uc-eyebrow">Your home, taken care of</p>
						<h1 className="uc-hero-title">Good morning, {customerFirstName}<span>.</span></h1>
						<p className="uc-hero-copy">Pick up where you left off. Your trusted professionals are ready when you are.</p>
					</div>
					<div className="uc-trust-note">
						<span className="uc-live-dot" /> Verified professionals available
					</div>
				</div>

				<div className="uc-two-col">
					<div>
						<div className="uc-section-heading">
							<div>
								<p className="uc-eyebrow">QuickRebook</p>
								<h2 className="uc-section-title">{selectedBooking ? `Rebook ${selectedBooking.service}` : "Book your usual service"}</h2>
							</div>
							<span className="uc-step-label">01 <span className="uc-step-sub">/ 02</span></span>
						</div>

						{selectedBooking ? (
							<article className="uc-service-card">
								<div className="uc-service-icon" aria-hidden="true">✦</div>
								<div className="uc-service-details">
									<div className="uc-service-topline">
										<span className="uc-service-category">Re-booking</span>
										<span className="uc-status-chip completed">PAST SERVICE #{selectedBooking.id}</span>
									</div>
									<h3 className="uc-service-title">{selectedBooking.service}</h3>
									<p style={{ margin: 0, color: "var(--uc-text-secondary)", fontSize: 12 }}>
										With <strong>{selectedBooking.professional}</strong>{" "}
										<span className="uc-verified">✓</span> <span className="uc-rating">★ 4.9</span>
									</p>
									<div className="uc-service-meta">
										<span>⌂ {customer?.address || "Registered Address"}</span>
										<span>◷ 2.5 hrs</span>
									</div>
								</div>
								<span className="uc-repeat-badge">Trusted Pro</span>
							</article>
						) : (
							<article className="uc-service-card">
								<div className="uc-service-icon" aria-hidden="true">✦</div>
								<div className="uc-service-details">
									<h3 className="uc-service-title">No completed booking selected</h3>
									<p style={{ margin: 0, color: "var(--uc-text-secondary)", fontSize: 12 }}>
										Select a completed service from your history on the right to re-book.
									</p>
								</div>
							</article>
						)}

						<div className="uc-booking-panel">
							<div className="uc-panel-header">
								<div>
									<h3 className="uc-panel-title">Choose a time</h3>
									<p className="uc-panel-sub">
										{selectedBooking ? `${selectedBooking.professional}'s live availability` : "Select a time slot"}
									</p>
								</div>
								<span className="uc-live-pill"><span className="uc-live-dot" /> LIVE</span>
							</div>

							{/* Date selection row */}
							<div className="uc-date-row" role="group" aria-label="Select a date">
								{defaultDates.map((dateItem) => (
									<button
										key={dateItem.fullDate}
										className={`uc-date-btn${selectedDateObj.fullDate === dateItem.fullDate ? " selected" : ""}`}
										onClick={() => {
											setSelectedDateObj(dateItem);
											setRebookSuccess(null);
											setRebookError(null);
										}}
										type="button"
									>
										<span>{dateItem.day}</span>
										<strong>{dateItem.date}</strong>
										<small>{dateItem.month}</small>
									</button>
								))}
							</div>

							{/* Time grid */}
							{loadingSlots ? (
								<div style={{ padding: "20px 0", textAlign: "center", color: "var(--uc-text-secondary)", fontSize: 13 }}>
									Checking professional availability...
								</div>
							) : slots.length === 0 ? (
								<div style={{ padding: "20px 0", textAlign: "center", color: "var(--uc-text-secondary)", fontSize: 13 }}>
									No slots available for this date.
								</div>
							) : (
								<div className="uc-time-grid" role="group" aria-label="Select a time">
									{slots.map((slot) => {
										const isBooked = slot.status !== "OPEN";
										const isSelected = selectedTime === slot.time;
										return (
											<button
												key={slot.time}
												className={`uc-time-btn${isSelected ? " selected" : ""}${isBooked ? " unavailable" : ""}`}
												onClick={() => {
													if (!isBooked) {
														setSelectedTime(slot.time);
														setRebookSuccess(null);
														setRebookError(null);
													}
												}}
												disabled={isBooked}
												type="button"
											>
												{slot.time}
												{isBooked && <small>{slot.status === "HELD" ? "Held" : "Booked"}</small>}
											</button>
										);
									})}
								</div>
							)}

							<div className="uc-address-row">
								<span className="uc-address-icon">⌂</span>
								<div>
									<small>Service address</small>
									<p>{customer?.address || "No address on file"}</p>
								</div>
								<button type="button" className="uc-btn-ghost">Change</button>
							</div>
						</div>

						{/* Feedback banners */}
						{rebookError && (
							<div className="uc-banner uc-banner-error" role="alert">
								<strong>⚠ Error:</strong> {rebookError}
							</div>
						)}

						{rebookSuccess && (
							<div className="uc-banner uc-banner-success" role="status">
								<strong>✓ Success:</strong> {rebookSuccess}
							</div>
						)}

						<div style={{ marginTop: 14 }}>
							<button
								className="uc-btn-primary"
								type="button"
								onClick={handleRebook}
								disabled={submitting || !selectedBooking || !selectedTime}
							>
								<span>
									{submitting
										? "Confirming booking..."
										: rebookSuccess
										? "Book Another Slot"
										: selectedTime
										? `Continue with ${selectedTime}`
										: "Select a time slot"}
								</span>
								<span className="btn-arrow" aria-hidden="true">→</span>
							</button>
						</div>
					</div>

					<aside>
						<div className="uc-side-heading">
							<h2 className="uc-section-title">Recent bookings</h2>
							<button type="button" className="uc-btn-secondary" onClick={() => fetchCustomerData()}>
								Refresh
							</button>
						</div>

						{bookings.length === 0 ? (
							<div className="uc-empty-state">
								No past bookings found.
							</div>
						) : (
							bookings.map((booking, idx) => {
								const isCompleted = booking.status === "COMPLETED";
								const isSelected = selectedBooking?.id === booking.id;
								const iconTheme = idx % 3 === 0 ? "" : idx % 3 === 1 ? "blue" : "amber";

								const formattedDate = new Date(booking.bookingDate).toLocaleDateString("en-IN", {
									day: "2-digit",
									month: "short",
									year: "numeric",
									timeZone: "Asia/Kolkata",
								});

								const statusClass = booking.status === "COMPLETED"
									? "completed"
									: booking.status === "CONFIRMED"
									? "confirmed"
									: booking.status === "HELD"
									? "held"
									: "cancelled";

								return (
									<article
										key={booking.id}
										className={`uc-history-card${isSelected ? " selected" : ""}`}
									>
										<div className={`uc-history-icon ${iconTheme}`}>
											{idx % 3 === 0 ? "✦" : idx % 3 === 1 ? "✧" : "⌁"}
										</div>
										<div className="uc-history-body">
											<span className={`uc-status-chip ${statusClass}`}>
												{booking.status}
											</span>
											<h3 className="uc-history-title">{booking.service}</h3>
											<p className="uc-history-meta">{formattedDate}</p>
											<strong className="uc-history-prof">
												{booking.professional} <span className="uc-rating">★ 4.9</span>
											</strong>
											{isCompleted && (
												<div style={{ marginTop: 8 }}>
													<button
														type="button"
														className={`uc-btn-outline${isSelected ? " active" : ""}`}
														onClick={() => {
															setSelectedBooking(booking);
															setRebookSuccess(null);
															setRebookError(null);
														}}
													>
														{isSelected ? "Selected for Rebook" : "Book Again ↻"}
													</button>
												</div>
											)}
										</div>
										<span className="uc-card-arrow" aria-hidden="true">→</span>
									</article>
								);
							})
						)}

						<div className="uc-help-banner">
							<span className="uc-help-icon">?</span>
							<div>
								<strong className="uc-help-title">Need something else?</strong>
								<p className="uc-help-sub">Explore 50+ home services</p>
							</div>
							<span className="uc-help-arrow" aria-hidden="true">↗</span>
						</div>
					</aside>
				</div>
			</section>

			<footer className="uc-footer">
				<span className="uc-footer-brand">QuickRebook</span>
				<span>Trusted home services, made simple.</span>
				<span>© 2026 Urban Company</span>
			</footer>
		</main>
	);
}
