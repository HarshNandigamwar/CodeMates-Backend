import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "https://res.cloudinary.com/darmatnf2/image/upload/v1772109026/user_pic_taeqah.png" },
    bio: { type: String, default: "Hey there! I am using CodeMates." },
    github: { type: String, default: "" },
    portfolio: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    techstack: [{ type: String }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
