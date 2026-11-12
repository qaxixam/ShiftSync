
import mongoose from "mongoose";
let isConnected = false;
export async function connectDB(): Promise<void> {
    if (isConnected) return;
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        isConnected=true;
       console.log("mongoose conncected");
       
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        throw error;
    }
}