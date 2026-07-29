const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

app.get("/", (req, res) => {
  res.send("Blade Ball Spin Backend is running!");
});


// Test kết nối Supabase
app.get("/test-db", async (req, res) => {
  try {

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .limit(1);

    if (error) {
      return res.json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      message: "Supabase connected!",
      data
    });

  } catch (err) {
    res.json({
      success: false,
      error: err.message
    });
  }
});


// Register account
app.post("/register", async (req, res) => {
  try {

    const { username, email, password } = req.body;


    if (!username || !email || !password) {
      return res.json({
        success: false,
        message: "Please fill all fields"
      });
    }


    // Check username/email exists
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .or(`username.eq.${username},email.eq.${email}`)
      .limit(1);


    if (checkError) {
      return res.json({
        success: false,
        error: checkError.message
      });
    }


    if (existingUser && existingUser.length > 0) {
      return res.json({
        success: false,
        message: "Username or email already exists"
      });
    }


    // Hash password
    


    // Insert user
    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          username: username,
          email: email,
          password: password
        }
      ])
      .select();


    if (error) {
      return res.json({
        success: false,
        error: error.message
      });
    }


    res.json({
      success: true,
      message: "Register successful",
      user: data[0]
    });


  } catch (err) {

    res.json({
      success: false,
      error: err.message
    });

  }
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
