import User from "../models/User.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cloudinary from "../config/cloudinary.js";

export const checkAuth = async (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in auth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

//  Register new user
//  POST /api/auth/signup
export const signup = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      name,
      bio,
      github,
      portfolio,
      linkedin,
      techstack,
    } = req.body;

    // Check if user already exists (Email or Username)
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res
        .status(400)
        .json({ message: "Username or Email already taken" });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in database
    const user = await User.create({
      username,
      name,
      email,
      bio,
      github,
      portfolio,
      linkedin,
      techstack,
      password: hashedPassword,
    });

    if (user) {
      // Token Generate
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.TOKEN_EXPIRY,
      });

      // Cookie set karein
      res.cookie("jwt_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Final Response
      res.status(201).json({
        _id: user._id,
        profilePic: user.profilePic,
        name: user.name,
        username: user.username,
        email: user.email,
        message: "User registered successfully",
      });
      console.log(user.name, "registered successfully");
    }
  } catch (error) {
    console.error("Signup Error:", error);
    res
      .status(500)
      .json({ message: "Server Error signup", error: error.message });
  }
};

//  Authenticate user & get token
// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (isPasswordMatch) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.TOKEN_EXPIRY,
      });

      res.cookie("jwt_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        _id: user._id,
        profilePic: user.profilePic,
        name: user.name,
        username: user.username,
        email: user.email,
        message: "Login successful",
      });
      console.log(user.name, "Login successful");
    } else {
      res.status(401).json({ message: "Invalid email or password" });
      console.log("Invalid email or password");
    }
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

//  Update Profile Picture
//  PUT /api/auth/update-profile-pic
export const updateProfilePic = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please upload an image" });
    }

    // Convert the buffer from Multer to a base64 string for Cloudinary
    const fileBase64 = req.file.buffer.toString("base64");
    const fileUri = `data:${req.file.mimetype};base64,${fileBase64}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(fileUri, {
      folder: "codemates/codemates_profiles",
      timeout: 60000,
    });

    // Save the Cloudinary URL to the user in MongoDB
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { profilePic: result.secure_url },
      { new: true }
    ).select("-password");

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Upload failed" });
  }
};

// Search users by username or name
// GET /api/auth/search/:query
export const searchUsers = async (req, res) => {
  try {
    const { query } = req.params;

    // 'i' means case-insensitive (don't care about uppercase/lowercase)
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: "i" } },
        { name: { $regex: query, $options: "i" } },
      ],
    }).select("username profilePic bio name");

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Search failed", error: error.message });
    console.log(error.message);
  }
};

// Follow/Unfollow a user
// POST /api/auth/follow/:id
export const followUnfollowUser = async (req, res) => {
  try {
    const { id } = req.params; // The ID of the person you want to follow
    const currentUser = await User.findById(req.user._id);
    const targetUser = await User.findById(id);

    if (!targetUser) return res.status(404).json({ message: "User not found" });

    // Don't let users follow themselves
    if (id === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    if (currentUser.following.includes(id)) {
      // Already following? Then Unfollow
      await User.findByIdAndUpdate(req.user._id, { $pull: { following: id } });
      await User.findByIdAndUpdate(id, { $pull: { followers: req.user._id } });
      res.status(200).json({ message: "User unfollowed successfully" });
    } else {
      // Not following? Then Follow
      await User.findByIdAndUpdate(req.user._id, { $push: { following: id } });
      await User.findByIdAndUpdate(id, { $push: { followers: req.user._id } });
      res.status(200).json({ message: "User followed successfully" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
    console.log(error.message);
  }
};
// Update Profile
export const updateProfile = async (req, res) => {
  let newPublicId = null;
  let oldPublicId = null;

  try {
    const userId = req.user._id;
    const { name, password, bio, github, portfolio, linkedin, techstack } =
      req.body;

    let user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // 1. Password Hash
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    // 2. Profile Picture Upload (New Image)
    if (req.file) {
      const fileBase64 = req.file.buffer.toString("base64");
      const fileUri = `data:${req.file.mimetype};base64,${fileBase64}`;

      const result = await cloudinary.uploader.upload(fileUri, {
        folder: "codemates/codemates_profiles",
        resource_type: "image",
      });

      // Purani image ka ID nikal lo lekin abhi delete MAT karo
      if (user.profilePic && !user.profilePic.includes("placehold.co")) {
        oldPublicId = user.profilePic
          .split("/")
          .slice(-3)
          .join("/")
          .split(".")[0];
      }

      // Nayee image ke details set karein
      user.profilePic = result.secure_url;
      newPublicId = result.public_id;
    }

    // 3. Other fields update
    user.name = name || user.name;
    user.bio = bio || user.bio;
    user.github = github || user.github;
    user.portfolio = portfolio || user.portfolio;
    user.linkedin = linkedin || user.linkedin;
    if (techstack) {
      try {
        user.techstack =
          typeof techstack === "string" ? JSON.parse(techstack) : techstack;
      } catch (e) {
        user.techstack = techstack.split(",").map((item) => item.trim());
      }
    }
    await user.save();

    if (oldPublicId) {
      cloudinary.uploader
        .destroy(oldPublicId)
        .catch((err) => console.error("Old Pic Delete Fail:", err));
    }

    res.status(200).json({
      _id: user._id,
      profilePic: user.profilePic,
      name: user.name,
      username: user.username,
      email: user.email,
      message: "User profile update successfully",
    });
  } catch (error) {
    console.error("Update Profile Error:", error);

    // ROLLBACK: Agar database fail hua, toh nayee upload ki hui image delete kardo
    if (newPublicId) {
      console.log("Database failed, rolling back new image...");
      await cloudinary.uploader
        .destroy(newPublicId)
        .catch((err) => console.error("Rollback Fail:", err));
    }

    res.status(500).json({ message: "Error updating profile" });
  }
};

// logout
export const logout = (req, res) => {
  res.cookie("jwt_token", "", { 
    httpOnly: true,
    secure: true, 
    sameSite: "none",
    expires: new Date(0), 
  });
  console.log("Logged out successfully");
  return res.status(200).json({ 
    success: true, 
    message: "Logged out successfully" 
  });
};
