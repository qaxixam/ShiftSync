import { signToken } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";


export async function POST(req:Request) {
    try {
        await connectDB();
        const { email, password } = await req.json();
        if (!email || !password) {
            return new Response(JSON.stringify({ error: "Email and password are required" }), { status: 400 });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return new Response(JSON.stringify({ error: "Invalid email or password" }), { status: 401 });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return new Response(JSON.stringify({ error: "Invalid email or password" }), { status: 401 });
        }
        const token = await signToken({
            userId: user._id.toString(),
            role: user.role,
            companyId: user.companyId.toString(),
        });

        return NextResponse.json({
            message: "Login successful",
            token,
            user: { name: user.name, email: user.email, role: user.role },
        });

    } catch (error) {
        console.log(error);
    }
}