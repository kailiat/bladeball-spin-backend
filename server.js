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

console.log("Has secret key:", !!process.env.SUPABASE_SECRET_KEY);
console.log("Secret starts with:", process.env.SUPABASE_SECRET_KEY?.slice(0, 12));

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



    // TEST MODE:
    // đang lưu password thường để test
    // sau này bật bcrypt lại

    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          username,
          email,
          password
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

  user: {

    id: data[0].id,
    username: data[0].username,
    email: data[0].email,
    password: data[0].password,
    created_at: data[0].created_at

  }

});



  } catch (err) {


    res.json({

      success:false,
      error:err.message

    });


  }

});





// Login account
app.post("/login", async (req,res)=>{


  try {


    const { email,password } = req.body;



    if(!email || !password){

      return res.json({

        success:false,
        message:"Please fill all fields"

      });

    }




    const { data: users,error } = await supabase

      .from("users")

      .select("*")

      .eq("email",email)

      .limit(1);





    if(error){

      return res.json({

        success:false,
        error:error.message

      });

    }





    if(!users || users.length === 0){


      return res.json({

        success:false,
        message:"Account not found"

      });


    }




    const user = users[0];




    // TEST MODE password thường

    if(password !== user.password){


      return res.json({

        success:false,
        message:"Wrong password"

      });


    }





    // Create JWT token
const token = jwt.sign(
  {
    id: user.id,
    username: user.username,
    email: user.email
  },
  process.env.JWT_SECRET,
  {
    expiresIn: "7d"
  }
);


// Save cookie
res.cookie("token", token, {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 7 * 24 * 60 * 60 * 1000
});


res.json({

  success:true,

  message:"Login successful",

  user:{

    id:user.id,
    username:user.username,
    email:user.email

  },

  token

});





  } catch(err){


    res.json({

      success:false,
      error:err.message

    });


  }


});


// Check current login user
app.get("/me", async (req, res) => {

  try {

    const token = req.cookies.token;

    if (!token) {
      return res.json({
        success: false,
        message: "Not logged in"
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    res.json({
      success: true,
      user: decoded
    });


  } catch (err) {

    res.json({
      success: false,
      message: "Invalid token"
    });

  }

});

// Spin Wheel
app.post("/spin", async (req, res) => {

  try {

    const token = req.cookies.token;

    if (!token) {
      return res.json({
        success: false,
        message: "Please login first"
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Get prizes
    const { data: prizes, error } = await supabase
      .from("prizes")
      .select("*");

    if (error) {
      return res.json({
        success: false,
        error: error.message
      });
    }

    if (!prizes || prizes.length === 0) {
      return res.json({
        success: false,
        message: "No prizes found"
      });
    }

    // Random number 1 -> 100
    const random = Math.floor(Math.random() * 100) + 1;

    let totalChance = 0;
    let reward = null;

    for (const prize of prizes) {

      totalChance += prize.chance;

      if (random <= totalChance) {
        reward = prize;
        break;
      }

    }

    // Safety
    if (!reward) {
      reward = prizes[prizes.length - 1];
    }

    res.json({

      success: true,

      message: "Spin successful",

      random,

      reward: {

        id: reward.id,
        name: reward.name,
        amount: reward.amount,
        chance: reward.chance

      },

      user: {

        id: decoded.id,
        username: decoded.username

      }

    });

  } catch (err) {

    res.json({

      success: false,
      error: err.message

    });

  }

});
const PORT = process.env.PORT || 3000;


app.listen(PORT,()=>{

  console.log(`Server running on port ${PORT}`);

});
