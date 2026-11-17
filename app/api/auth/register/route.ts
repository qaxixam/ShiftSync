import { signToken } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Company from "@/models/Company";
import User from "@/models/User";

import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";


export async function POST(req:Request){
   try {
    await connectDB()
     const {name, email, password, companyName}=await req.json();

     if (!name || !email || !password || !companyName) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }
    
    const existingUser = await User.findOne({ email });
    if(existingUser){
        return NextResponse.json(
            { error: "User already exists" },
            { status: 400 }
          );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const company = await Company.create({ name: companyName });

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
      companyId: company._id,
    });

     company.createdBy = user._id;
         await company.save();

    const token =await signToken({
      userId: user._id.toString(),
      role: user.role,
      companyId: company._id.toString(),
    });

     return NextResponse.json({
      message: "Registered successfully",
      token,
      user: { name: user.name, email: user.email, role: user.role },
    });
   } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
    
   }



}