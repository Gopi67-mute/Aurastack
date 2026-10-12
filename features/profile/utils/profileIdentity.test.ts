import { getDisplayName, getInitials } from "./profileIdentity";

describe("getDisplayName", () => {
  it("greets by first name, like Home", () => {
    expect(getDisplayName({ firstName: "Ada", lastName: "Lovelace", fullName: "Ada Lovelace" })).toBe("Ada");
  });

  it("falls back through full name, username and the email's local part", () => {
    expect(getDisplayName({ firstName: "  ", fullName: "Ada Lovelace" })).toBe("Ada Lovelace");
    expect(getDisplayName({ username: "ada_l" })).toBe("ada_l");
    expect(getDisplayName({ email: "ada.lovelace@example.com" })).toBe("ada.lovelace");
  });

  it("uses a neutral label when nothing is known", () => {
    expect(getDisplayName({})).toBe("Your account");
  });
});

describe("getInitials", () => {
  it("takes the first letters of the first and last name", () => {
    expect(getInitials({ firstName: "ada", lastName: "lovelace" })).toBe("AL");
  });

  it("uses one letter for a single name", () => {
    expect(getInitials({ firstName: "Ada" })).toBe("A");
  });

  it("uses the first and last words of the full name when first/last are missing", () => {
    expect(getInitials({ fullName: "Ada King Lovelace" })).toBe("AL");
  });

  it("falls back to the username, then the email", () => {
    expect(getInitials({ username: "zed" })).toBe("Z");
    expect(getInitials({ email: "jane.doe@example.com" })).toBe("J");
  });

  it("keeps non-Latin letters whole", () => {
    expect(getInitials({ firstName: "Élodie", lastName: "Ωmega" })).toBe("ÉΩ");
    expect(getInitials({ firstName: "𝒜da" })).toBe("𝒜");
  });

  it("is empty when there is nothing to derive from", () => {
    expect(getInitials({})).toBe("");
  });
});
