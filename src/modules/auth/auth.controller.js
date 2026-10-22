import { register } from "./auth.service.js";

// Express 5 forwards rejected promises to the error handler, so no try/catch.
// Only ever read req.validated, never raw req.body.
export async function registerController(req, res) {
  const user = await register(req.validated.body);

  res.status(201).json({
    success: true,
    data: { user },
    message: "Account created. Check your email to verify your address.",
  });
}
