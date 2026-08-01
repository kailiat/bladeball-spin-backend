const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const path = require("path");

const app = express();

app.use(cors({
  origin:true,
  credentials:true
}));
app.use(express.json());
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "public")));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

console.log("Has secret key:", !!process.env.SUPABASE_SECRET_KEY);
console.log("Secret starts with:", process.env.SUPABASE_SECRET_KEY?.slice(0, 12));



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

// Test bảng prizes
app.get("/test-prizes", async (req, res) => {

  try {

    const { data, error } = await supabase
      .from("prizes")
      .select("*");

    res.json({
      success: !error,
      error,
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

    const { account, password } = req.body;


    if (!account || !password) {

      return res.json({
        success:false,
        message:"Please fill all fields"
      });

    }


    let username = null;
    let email = null;


    if(account.includes("@")){
        email = account;
    }else{
        username = account;
    }


   



    // Check username/email exists
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .or(`username.eq.${account},email.eq.${account}`)
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
 password,
 spin_chances:0,
 tokens:0
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


    const { account,password } = req.body;



    if(!account || !password){

  return res.json({

    success:false,
    message:"Please fill all fields"

  });

}




    const { data: users,error } = await supabase

      .from("users")
.select("*")
.or(`email.eq.${account},username.eq.${account}`)
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
        success:false,
        message:"Not logged in"
      });
    }


    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );


    const { data:user, error } = await supabase
      .from("users")
      .select("id, username, email, tokens, spin_chances")
      .eq("id", decoded.id)
      .single();


    if(error){
      return res.json({
        success:false,
        error:error.message
      });
    }


    res.json({
      success:true,
      user
    });


  } catch(err){

    res.json({
      success:false,
      message:"Invalid token"
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
    const rewardSlots = {
  1: [0],
  2: [1],
  3: [2]
};

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
    const slots = rewardSlots[reward.id] || [0];

const slot = slots[
  Math.floor(Math.random() * slots.length)
];
// Lấy dữ liệu user hiện tại
const { data: userData, error: userError } = await supabase
  .from("users")
  .select("*")
  .eq("id", decoded.id)
  .single();
    if (userError) {
  return res.json({
    success:false,
    error:userError.message
  });
}


// kiểm tra lượt quay
if(Number(userData.spin_chances || 0) <= 0){

  return res.json({
    success:false,
    message:"No spin chance"
  });

}

if (userError) {
  return res.json({
    success: false,
    error: userError.message
  });
}

// Cộng Token
const newBalance =
  Number(userData.tokens || 0) + Number(reward.amount);


const newSpin =
  Number(userData.spin_chances || 0) - 1;


// Update Token + giảm lượt quay
await supabase
  .from("users")
  .update({
    tokens: newBalance,
    spin_chances: newSpin
  })
  .eq("id", decoded.id);

// Lưu lịch sử quay
await supabase
  .from("spin_history")
  .insert({
    user_id: decoded.id,
    reward: reward.name,
    amount: reward.amount,
    spin_date: new Date().toISOString().slice(0,10)
  });
    console.log("========== SPIN ==========");
console.log("Random:", random);
console.log("Reward:", reward);
console.log("Amount:", reward.amount);
console.log("Balance:", newBalance);
console.log("==========================");
    res.json({

  success: true,

  message: "Spin successful",

  random,

  reward: {
    id: reward.id,
    name: reward.name,
    amount: reward.amount,
    chance: reward.chance,
    slot: slot
  },

  balance: newBalance,
  spin_chances: newSpin,

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
// Get Spin History
app.get("/history", async (req, res) => {

  try {

    const token = req.cookies.token;

    if (!token) {
      return res.json({
        success: false,
        message: "Please login first"
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const { data, error } = await supabase
      .from("spin_history")
      .select("*")
      .eq("user_id", decoded.id)
      .order("created_at", { ascending: false });
    console.log("History error:", error);
console.log("History data:", data);

    if (error) {
      return res.json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      history: data
    });

  } catch (err) {

    res.json({
      success: false,
      error: err.message
    });

  }

});
app.post("/logout", (req, res) => {

  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "none"
  });

  res.json({
    success: true,
    message: "Logout successful"
  });

});
// Claim Free Spin
app.post("/claim-free-spin", async (req,res)=>{

  try {

    const token = req.cookies.token;

    if(!token){
      return res.json({
        success:false,
        message:"Please login first"
      });
    }


    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );


    // lấy user
    const { data:userData, error:userError } =
    await supabase
    .from("users")
    .select("*")
    .eq("id", decoded.id)
    .single();


    if(userError){
      return res.json({
        success:false,
        error:userError.message
      });
    }


    // cộng 1 lượt
    const newSpin =
    Number(userData.spin_chances || 0) + 1;


    const { error:updateError } =
    await supabase
    .from("users")
    .update({
      spin_chances:newSpin
    })
    .eq("id", decoded.id);



    if(updateError){

      return res.json({
        success:false,
        error:updateError.message
      });

    }


    res.json({

      success:true,

      message:"Free spin claimed!",

      spin_chances:newSpin

    });


  }catch(err){

    res.json({

      success:false,
      error:err.message

    });

  }

});
const PORT = process.env.PORT || 3000;


app.listen(PORT,()=>{

  console.log(`Server running on port ${PORT}`);

});
