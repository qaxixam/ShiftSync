import mongoose, { Schema, models, model } from "mongoose";

const CompanySchema = new Schema(
  {
    name:
     { 
        type: String,
         required: true
        
        },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default models.Company || model("Company", CompanySchema);