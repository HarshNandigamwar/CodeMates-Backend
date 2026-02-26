import User from "../models/User.model.js";
import Post from "../models/Post.model.js";

// Get user profile data by username
// GET /api/auth/profile/:username

export const getUserProfile = async (req, res) => {
  try {
    const { username } = req.params;

    // Find user by username
    const user = await User.findOne({ username })
      .select("-password")
      .populate("followers", "username name profilePic")
      .populate("following", "username name profilePic");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find all posts created by this user
    const posts = await Post.find({ user: user._id })
      .sort({ createdAt: -1 }) // Newest posts first
      .populate("user", "username name profilePic");

    // Construct the response
    res.status(200).json({
      user: {
        ...user._doc,
        followersCount: user.followers.length,
        followingCount: user.following.length,
        postsCount: posts.length,
      },
      posts,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching profile", error: error.message });

    console.log(error);
  }
};

export const getSuggestedUsers = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const users = await User.find({ _id: { $ne: loggedInUserId } })
      .select("-password")

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users" });
    console.log(error);
  }
};
