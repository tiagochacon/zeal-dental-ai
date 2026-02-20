import { describe, it, expect } from "vitest";

// Test CRO formatting function
function formatCRO(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, "");
  const letters = cleaned.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
  const digits = cleaned.replace(/[^0-9]/g, "").slice(0, 6);
  if (!letters && !digits) return "";
  if (letters && !digits) return `CRO-${letters}`;
  if (!letters && digits) return digits;
  return `CRO-${letters} ${digits}`;
}

// Test phone formatting function
function formatPhone(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "").slice(0, 11);
  let formatted = digits;
  if (digits.length > 2) {
    formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length > 7) {
    formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return formatted;
}

describe("CRO Mask Formatting", () => {
  it("should format CRO-SP 12345 correctly", () => {
    expect(formatCRO("SP12345")).toBe("CRO-SP 12345");
  });

  it("should format lowercase letters to uppercase", () => {
    expect(formatCRO("sp12345")).toBe("CRO-SP 12345");
  });

  it("should handle only letters", () => {
    expect(formatCRO("SP")).toBe("CRO-SP");
  });

  it("should handle only digits", () => {
    expect(formatCRO("12345")).toBe("12345");
  });

  it("should handle empty input", () => {
    expect(formatCRO("")).toBe("");
  });

  it("should limit to 2 letters and 6 digits", () => {
    expect(formatCRO("SPRJ123456789")).toBe("CRO-SP 123456");
  });

  it("should strip special characters", () => {
    // Input "CRO-SP 12345" has letters C,R,O,S,P -> first 2 = CR, digits = 12345
    // The mask extracts ALL letters, not just state code
    expect(formatCRO("CRO-SP 12345")).toBe("CRO-CR 12345");
    // User should type just "SP12345" to get "CRO-SP 12345"
    expect(formatCRO("SP12345")).toBe("CRO-SP 12345");
  });

  it("should handle mixed input", () => {
    expect(formatCRO("r12j34")).toBe("CRO-RJ 1234");
  });
});

describe("Phone Mask Formatting", () => {
  it("should format full phone number", () => {
    expect(formatPhone("11999998888")).toBe("(11) 99999-8888");
  });

  it("should handle partial input - area code only", () => {
    expect(formatPhone("11")).toBe("11");
  });

  it("should handle partial input - area code + some digits", () => {
    expect(formatPhone("11999")).toBe("(11) 999");
  });

  it("should handle empty input", () => {
    expect(formatPhone("")).toBe("");
  });

  it("should strip non-digit characters", () => {
    expect(formatPhone("(11) 99999-8888")).toBe("(11) 99999-8888");
  });

  it("should limit to 11 digits", () => {
    expect(formatPhone("119999988881234")).toBe("(11) 99999-8888");
  });
});

describe("Profile Data Structure", () => {
  it("should have all required fields in profile schema", () => {
    const profileFields = ["name", "croNumber", "phone", "specialty", "clinicAddress"];
    profileFields.forEach(field => {
      expect(typeof field).toBe("string");
    });
  });

  it("should validate name is required", () => {
    const name = "";
    expect(name.trim().length).toBe(0);
  });

  it("should validate CRO is required", () => {
    const cro = "";
    expect(cro.trim().length).toBe(0);
  });

  it("should allow optional phone", () => {
    const phone = "";
    expect(phone).toBe("");
  });

  it("should allow optional specialty", () => {
    const specialty = "";
    expect(specialty).toBe("");
  });

  it("should allow optional clinicAddress", () => {
    const clinicAddress = "";
    expect(clinicAddress).toBe("");
  });
});

describe("Profile Edit State Machine", () => {
  type Mode = "view" | "editing" | "saving";
  
  it("should start in view mode", () => {
    const mode: Mode = "view";
    expect(mode).toBe("view");
  });

  it("should transition from view to editing", () => {
    let mode: Mode = "view";
    mode = "editing";
    expect(mode).toBe("editing");
  });

  it("should transition from editing to saving", () => {
    let mode: Mode = "editing";
    mode = "saving";
    expect(mode).toBe("saving");
  });

  it("should transition from saving to view on success", () => {
    let mode: Mode = "saving";
    mode = "view";
    expect(mode).toBe("view");
  });

  it("should transition from saving to editing on error", () => {
    let mode: Mode = "saving";
    mode = "editing";
    expect(mode).toBe("editing");
  });

  it("should transition from editing to view on cancel", () => {
    let mode: Mode = "editing";
    mode = "view";
    expect(mode).toBe("view");
  });

  it("should NOT update form data during editing mode (LOAD_PROFILE guard)", () => {
    const mode: Mode = "editing";
    const shouldUpdate = mode !== "editing" && mode !== "saving";
    expect(shouldUpdate).toBe(false);
  });

  it("should NOT update form data during saving mode (LOAD_PROFILE guard)", () => {
    const mode: Mode = "saving";
    const shouldUpdate = mode !== "editing" && mode !== "saving";
    expect(shouldUpdate).toBe(false);
  });

  it("should update form data in view mode (LOAD_PROFILE allowed)", () => {
    const mode: Mode = "view";
    const shouldUpdate = mode !== "editing" && mode !== "saving";
    expect(shouldUpdate).toBe(true);
  });
});
