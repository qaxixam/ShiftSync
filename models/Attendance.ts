import { Schema, models, model } from "mongoose";

const AttendanceSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    shiftId: { type: Schema.Types.ObjectId, ref: "Shift", required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    clockInTime: { type: Date },
    clockOutTime: { type: Date },
    clockInLocation: {
      latitude: Number,
      longitude: Number,
    },
    status: {
      type: String,
      enum: ["clocked-in", "clocked-out"],
      default: "clocked-in",
    },
  },
  { timestamps: true }
);

export default models.Attendance || model("Attendance", AttendanceSchema);