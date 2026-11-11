import argon2 from "argon2";
import { User } from "../../src/modules/users/user.model.js";

export async function createUser(overrides = {}) {
  const { password = "correct-horse-9", ...rest } = overrides;
  const user = await User.create({
    fullName: "Ada Obi",
    email: "ada@example.com",
    passwordHash: await argon2.hash(password),
    status: "active",
    ...rest,
  });
  return { user, password };
}
