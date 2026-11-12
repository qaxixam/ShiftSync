import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req: Request) {
  try {
    await connectDB();

    const role = req.headers.get("x-user-role");
    const companyId = req.headers.get("x-company-id");

    // RBAC check: sirf admin ye kaam kar sakta hai
    if (role !== "admin") {
      return NextResponse.json(
        { error: "Only admin can add employees" },
        { status: 403 }
      );
    }

    const { name, email, password, newRole } = await req.json();

    if (!["manager", "employee"].includes(newRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: newRole,
      companyId,
    });

    return NextResponse.json({
      message: "Employee added",
      user: { name: newUser.name, email: newUser.email, role: newUser.role },
    });
  } catch (err) {
    console.error("Add employee error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}