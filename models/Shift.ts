import { Schema, models, model } from "mongoose";

const ShiftSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ["scheduled", "open", "claimed", "completed", "cancelled"],
      default: "scheduled",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default models.Shift || model("Shift", ShiftSchema);