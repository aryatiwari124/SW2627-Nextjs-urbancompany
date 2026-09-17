/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import LoginPage from "@/app/login/page";
import SignupPage from "@/app/signup/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

describe("Frontend Component Tests: Auth Forms", () => {
  describe("LoginPage Component", () => {
    it("renders welcome header, inputs, and demo accounts", () => {
      render(<LoginPage />);

      expect(screen.getByText("Welcome back")).toBeTruthy();
      expect(screen.getByLabelText("Email address")).toBeTruthy();
      expect(screen.getByLabelText("Password")).toBeTruthy();
      expect(screen.getByRole("button", { name: /sign in/i })).toBeTruthy();
      expect(screen.getByText("Ananya Sharma")).toBeTruthy();
      expect(screen.getByText("Priya S.")).toBeTruthy();
    });

    it("clicking a demo button automatically fills email and password", () => {
      render(<LoginPage />);

      const ananyaBtn = screen.getByText("Ananya Sharma").closest("button");
      expect(ananyaBtn).toBeTruthy();
      fireEvent.click(ananyaBtn!);

      const emailInput = screen.getByLabelText("Email address") as HTMLInputElement;
      const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;

      expect(emailInput.value).toBe("ananya@gmail.com");
      expect(passwordInput.value).toBe("password123");
    });
  });

  describe("SignupPage Component", () => {
    it("renders role selector tabs and switches between Customer and Professional", () => {
      render(<SignupPage />);

      expect(screen.getByText("Create an account")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Customer" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Professional" })).toBeTruthy();

      // By default Customer is selected -> Address field is visible
      expect(screen.getByLabelText(/Service Address/i)).toBeTruthy();

      // Switch to Professional
      const proTab = screen.getByRole("button", { name: "Professional" });
      fireEvent.click(proTab);

      // Address field should not be rendered for Professional
      expect(screen.queryByLabelText(/Service Address/i)).toBeNull();

      // Phone is required for Professional
      expect(screen.getByLabelText(/phone number/i)).toBeTruthy();
    });
  });
});
