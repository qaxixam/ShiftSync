import { Schema, models, model } from "mongoose";

const LocationSchema = new Schema(
  {
    name: { type: String, required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    radiusMeters: { type: Number, default: 100 }, // geofence radius
  },
  { timestamps: true }
);

export default models.Location || model("Location", LocationSchema);