/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CustomerPage from "@/app/customer/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("Frontend Component Tests: Customer Dashboard & Rebook Flow", () => {
  const mockCustomerData = {
    customer: {
      id: 1,
      name: "Ananya Sharma",
      email: "ananya@gmail.com",
      phone: "9876543210",
      address: "28, Indiranagar, Bengaluru",
    },
    bookings: [
      {
        id: 10,
        service: "AC Deep Clean",
        professionalId: 5,
        professional: "Priya S.",
        bookingDate: "2026-08-20T08:30:00.000Z",
        status: "COMPLETED",
      },
      {
        id: 11,
        service: "Bathroom Cleaning",
        professionalId: 6,
        professional: "Rahul M.",
        bookingDate: "2026-08-25T08:30:00.000Z",
        status: "CONFIRMED",
      },
    ],
  };

  const mockCalendarSlots = {
    professional: { id: 5, name: "Priya S.", phone: "9876543210" },
    date: "2026-08-26",
    slots: [
      { time: "09:00 AM", status: "OPEN" },
      { time: "11:30 AM", status: "OPEN" },
      { time: "02:00 PM", status: "BOOKED" },
      { time: "04:30 PM", status: "OPEN" },
      { time: "07:00 PM", status: "OPEN" },
    ],
    availableSlots: [],
    bookedSlots: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders 'Book Again' button ONLY for COMPLETED bookings", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ user: { id: 1, role: "CUSTOMER", email: "ananya@gmail.com" } }),
        });
      }
      if (url.includes("/api/customer")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockCustomerData),
        });
      }
      if (url.includes("/api/professionals/")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockCalendarSlots),
        });
      }
      return Promise.reject(new Error("Unknown route: " + url));
    });

    render(<CustomerPage />);

    await waitFor(() => {
      expect(screen.getAllByText("AC Deep Clean").length).toBeGreaterThan(0);
    });

    // COMPLETED booking should have a 'Book Again' or 'Selected for Rebook' button
    const bookAgainButtons = screen.getAllByRole("button", { name: /book again|selected for rebook/i });
    expect(bookAgainButtons).toHaveLength(1);

    // CONFIRMED booking is present, but should NOT have a Book Again button
    expect(screen.getByText("Bathroom Cleaning")).toBeTruthy();
    expect(screen.getByText("CONFIRMED")).toBeTruthy();
  });

  it("displays 409 conflict error banner when slot is already taken", async () => {
    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ user: { id: 1, role: "CUSTOMER", email: "ananya@gmail.com" } }),
        });
      }
      if (url.includes("/api/customer")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockCustomerData),
        });
      }
      if (url.includes("/api/professionals/")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockCalendarSlots),
        });
      }
      if (url.includes("/rebook")) {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: () => Promise.resolve({ error: "That time slot is no longer available. Please select another open slot." }),
        });
      }
      return Promise.reject(new Error("Unknown route: " + url));
    });

    render(<CustomerPage />);

    await waitFor(() => {
      expect(screen.getAllByText("AC Deep Clean").length).toBeGreaterThan(0);
    });

    // Select an open slot (09:00 AM)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "09:00 AM" })).toBeTruthy();
    });

    const slotBtn = screen.getByRole("button", { name: "09:00 AM" });
    fireEvent.click(slotBtn);

    // Find and click the confirm button (which now contains "Continue with 09:00 AM")
    await waitFor(() => {
      expect(screen.getByText(/continue with 09:00 AM/i)).toBeTruthy();
    });
    const confirmBtn = screen.getByText(/continue with 09:00 AM/i).closest("button");
    expect(confirmBtn).toBeTruthy();
    fireEvent.click(confirmBtn!);

    // Error banner should be rendered
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText(/no longer available/i)).toBeTruthy();
    });
  });
});
