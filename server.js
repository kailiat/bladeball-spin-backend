const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const path = require("path");
const crypto = require("crypto");

const app = express();
const spinCooldown = new Map();
const watchSessions = {}; // 🔥 thêm dòng này
const claimLocks = {};
const spinningUsers = new Set();

app.use(cors({
  origin:true,
  credentials:true
}));
app.use(express.json());
app.use(cookieParser());
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";

app.use(express.static(path.join(__dirname, "public")));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// =============================
// AUTO FAKE LIVE FEED
// =============================

const fakeNames = [
  "ShadowWolf",
  "LuckyStar",
  "MoonLight",
  "DragonX",
  "FireBlade",
  "CyberWolf",
  "NightKing",
  "BluePhoenix",
  "DarkHunter",
  "GoldenTiger",
  "IceMaster",
  "StormPlayer",
  "NovaX",
  "GhostFire",
  "AlphaWolf",
  "ZeroKing",
  "PixelHero",
  "RedShadow",
  "SkyDragon",
  "UltraLuck"
];


const fakeRewards = [
  {
    reward:"50 Tokens",
    amount:50
  },
  {
    reward:"100 Tokens",
    amount:100
  },
  {
    reward:"250 Tokens",
    amount:250
  },
  {
    reward:"500 Tokens",
    amount:500
  }
];


async function createFakeFeed(){

try{


const name =
fakeNames[
Math.floor(Math.random()*fakeNames.length)
];


const prize =
fakeRewards[
Math.floor(Math.random()*fakeRewards.length)
];



await supabase
.from("live_feed")
.insert({

username:name,

reward:prize.reward,

amount:prize.amount,

is_fake:true

});

console.log(
"Fake feed:",
name,
prize.reward
);



}catch(err){

console.log(
"Fake feed error:",
err.message
);


}


}


// tạo feed mỗi 15-40 giây

setInterval(()=>{

createFakeFeed();

},20000);
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
tokens:0,
lootlabs_progress: 0,
linkvertise_progress: 0,
last_mission_date: new Date().toISOString().slice(0,10)
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
  let userId = null;

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

    userId = decoded.id;

    const { data:user, error } = await supabase
      .from("users")
      .select(`
id,
username,
email,
tokens,
spin_chances,
last_claim_date,
lootlabs_progress,
linkvertise_progress,
last_mission_date,
created_at
`)
      .eq("id", userId)
      .single();

    if(error){
      return res.json({
        success:false,
        error:error.message
      });
    }
    // 🔥 TOTAL SPINS
const { count: total_spins } = await supabase
.from("spin_history")
.select("*", { count: "exact", head: true })
.eq("user_id", userId);

// 🔥 TOTAL WON
const { data: wonData } = await supabase
.from("spin_history")
.select("amount")
.eq("user_id", userId);

let total_won = 0;

if (wonData) {
  wonData.forEach(i => {
    total_won += Number(i.amount || 0);
  });
}
// 🔥 TOTAL WITHDRAW
const { data: withdrawData } = await supabase
.from("withdraw_requests")
.select("amount")
.eq("user_id", userId);

let total_withdraw = 0;

if (withdrawData) {
  withdrawData.forEach(i => {
    total_withdraw += Number(i.amount || 0);
  });
}

    const today = new Date().toISOString().slice(0,10);

    if(user.last_mission_date !== today){
      await supabase
        .from("users")
        .update({
          lootlabs_progress: 0,
          linkvertise_progress: 0,
          last_mission_date: today
        })
        .eq("id", userId);

      user.lootlabs_progress = 0;
      user.linkvertise_progress = 0;
    }

    res.json({
  success:true,
  user:{
    ...user,
    total_spins,
    total_won,
    total_withdraw
  }
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
  let userId = null;

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

    userId = decoded.id;

    // ✅ CHẶN SPAM
    if (spinningUsers.has(userId)) {
      return res.json({
        success: false,
        message: "Please wait"
      });
    }

    spinningUsers.add(userId);

    // 🔥 LẤY USER
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError) {
      return res.json({
        success: false,
        error: userError.message
      });
    }

    const today = new Date().toISOString().slice(0,10);

    // ✅ RESET MISSION
    if (userData.last_mission_date !== today) {
      await supabase
        .from("users")
        .update({
          lootlabs_progress: 0,
          linkvertise_progress: 0,
          last_mission_date: today
        })
        .eq("id", userId);

      userData.lootlabs_progress = 0;
      userData.linkvertise_progress = 0;
    }

    // ❌ HẾT LƯỢT
    if (Number(userData.spin_chances || 0) <= 0) {
      return res.json({
        success: false,
        message: "No spin chance"
      });
    }

    // 🎯 RANDOM
    const random = Math.random() * 100;

    const { data: prizes } = await supabase
      .from("prizes")
      .select("*");

    let reward = prizes[0];
    let cumulative = 0;

    for (let p of prizes) {
      cumulative += Number(p.chance);
      if (random <= cumulative) {
        reward = p;
        break;
      }
    }

    const slot = reward.slot || 0;

    // 💰 CỘNG TOKEN
    const newBalance =
      Number(userData.tokens || 0) + Number(reward.amount);

    const newSpin =
      Number(userData.spin_chances || 0) - 1;

    await supabase
      .from("users")
      .update({
        tokens: newBalance,
        spin_chances: newSpin
      })
      .eq("id", userId);

    // 🧾 HISTORY
    await supabase
      .from("spin_history")
      .insert({
        user_id: userId,
        reward: reward.label || reward.name,
        amount: reward.amount,
        spin_date: today
      });

    // 📡 LIVE FEED
    await supabase
      .from("live_feed")
      .insert({
        username: decoded.username,
        reward: reward.name,
        amount: reward.amount,
        is_fake: false
      });

    return res.json({
      success: true,
      random,
      reward,
      balance: newBalance,
      spin_chances: newSpin
    });

  } catch (err) {
    return res.json({
      success: false,
      error: err.message
    });
  } finally {
    if (userId) {
      spinningUsers.delete(userId);
    }
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

const decoded = jwt.verify(token, process.env.JWT_SECRET);

// 🎲 SPIN
const { data: spins } = await supabase
  .from("spin_history")
  .select("*")
  .eq("user_id", decoded.id);

// 💸 WITHDRAW
const { data: withdraws } = await supabase
  .from("withdraw_requests")
  .select("*")
  .eq("user_id", decoded.id);

let history = [];

// SPIN
spins.forEach(s => {
  history.push({
    type: "spin",
    reward: s.reward,
    amount: s.amount,
    created_at: s.created_at
  });
});

// WITHDRAW
withdraws.forEach(w => {
  history.push({
    type: "withdraw",
    reward: "Withdraw",
    amount: w.amount,
    status: w.status,
    created_at: w.created_at
  });
});

// SORT
history.sort((a,b)=>
  new Date(b.created_at) - new Date(a.created_at)
);

res.json({
  success: true,
  history
});

} catch (err) {
res.json({
  success: false,
  error: err.message
});
}
});
// =============================
// LIVE FEED
// =============================
app.get("/live-feed", async (req,res)=>{

try{

const { data, error } = await supabase
.from("live_feed")
.select("*")
.not("amount","eq",0)
.order("created_at",{ascending:false})
.limit(30);

if(error){

return res.json({
success:false,
error:error.message
});

}
  // Random vị trí feed để mỗi lần load không giống nhau
if (data && data.length > 1) {
  data.sort(() => Math.random() - 0.5);
}

res.json({
success:true,
feed:data
});

}catch(err){

res.json({
success:false,
error:err.message
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


// =============================
// COMPLETE MISSION
// =============================


app.post("/withdraw", async(req,res)=>{

try{

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


const {
type,
amount,
item_id,
quantity,
roblox_username,
discord_username
}=req.body;



const {data:userData,error:userError}=await supabase
.from("users")
.select("*")
.eq("id",decoded.id)
.single();


if(userError){
return res.json({
success:false,
error:userError.message
});
}



// TOKEN WITHDRAW
if(type==="token"){


const withdrawAmount = Number(amount);


if(withdrawAmount < 5){
return res.json({
success:false,
message:"Minimum 5 tokens"
});
}


if(userData.tokens < withdrawAmount){

return res.json({
success:false,
message:"Not enough tokens"
});

}



const { data:withdrawData, error:withdrawError } =
await supabase
.from("withdraw_requests")
.insert({

    user_id:userData.id,

    type:"token",

    amount:withdrawAmount,

    roblox_username,

    discord_username,

    status:"pending"

})
.select();


if(withdrawError){

    return res.json({
        success:false,
        error:withdrawError.message
    });

}



await supabase
.from("users")
.update({

tokens:userData.tokens-withdrawAmount

})
.eq("id",decoded.id);



return res.json({

success:true,

message:"Token withdraw sent!"

});


}




// ITEM WITHDRAW
if(type==="item"){


return res.json({

success:false,

message:"Item withdraw is not ready"

});


}



res.json({

success:false,

message:"Invalid withdraw type"

});


}

catch(err){

res.json({

success:false,

error:err.message

});

}


});
app.post("/admin/login", (req, res) => {

  const { password } = req.body;

  if (password !== ADMIN_PASSWORD) {

    return res.json({
      success: false,
      message: "Wrong password"
    });

  }

  res.cookie("admin", "true", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({
    success: true
  });

});


// =============================
// ADMIN DASHBOARD
// =============================
app.get("/admin/dashboard", async (req, res) => {

    if(req.cookies.admin !== "true"){

        return res.json({
            success:false,
            message:"Unauthorized"
        });

    }

    try{

        // Total Users
        const { count:userCount } = await supabase
        .from("users")
        .select("*",{count:"exact",head:true});

        // Total Spins
        const { count:spinCount } = await supabase
        .from("spin_history")
        .select("*",{count:"exact",head:true});

        // Withdraw
        const { data:withdraws } = await supabase
        .from("withdraw_requests")
        .select("status");

        let pending=0;
        let completed=0;
        let rejected=0;

        withdraws.forEach(w=>{

            if(w.status==="pending") pending++;
            if(w.status==="completed") completed++;
            if(w.status==="rejected") rejected++;

        });

        // Total Token
        const { data:users } = await supabase
        .from("users")
        .select("tokens");

        let totalTokens=0;

        users.forEach(u=>{

            totalTokens += Number(u.tokens||0);

        });

        res.json({

            success:true,

            stats:{
                users:userCount||0,
                tokens:totalTokens,
                spins:spinCount||0,
                withdraws:withdraws.length,
                pending,
                completed,
                rejected
            }

        });

    }catch(err){

        res.json({
            success:false,
            error:err.message
        });

    }

});
// =============================
// ADMIN - GET ALL WITHDRAWS
// =============================
app.get("/admin/withdraws", async (req, res) => {
  if(req.cookies.admin !== "true"){

    return res.json({
        success:false,
        message:"Unauthorized"
    });

}

try{

const { data, error } = await supabase
.from("withdraw_requests")
.select(`
*,
users(username)
`)
.order("created_at",{ascending:false});

if(error){

return res.json({
success:false,
error:error.message
});

}

res.json({
success:true,
data
});

}catch(err){

res.json({
success:false,
error:err.message
});

}

});
app.post("/admin/approve", async (req,res)=>{
  if(req.cookies.admin !== "true"){

    return res.json({
        success:false,
        message:"Unauthorized"
    });

}

try{

const {id}=req.body;

await supabase
.from("withdraw_requests")
.update({
status:"completed"
})
.eq("id",id);

res.json({
success:true
});

}catch(err){

res.json({
success:false,
error:err.message
});

}

});
// =============================
// ADMIN - REJECT WITHDRAW
// =============================
app.post("/admin/reject", async (req,res)=>{
  if(req.cookies.admin !== "true"){

    return res.json({
        success:false,
        message:"Unauthorized"
    });

}

try{

const { id } = req.body;

// Lấy request
const { data: withdraw } = await supabase
.from("withdraw_requests")
.select("*")
.eq("id", id)
.single();

if(!withdraw){

return res.json({
success:false,
message:"Withdraw not found"
});

}

// Chỉ reject khi pending
if(withdraw.status !== "pending"){

return res.json({
success:false,
message:"Already processed"
});

}

// Lấy user
const { data:user } = await supabase
.from("users")
.select("*")
.eq("id", withdraw.user_id)
.single();

// Trả token
await supabase
.from("users")
.update({

tokens:Number(user.tokens)+Number(withdraw.amount)

})
.eq("id", withdraw.user_id);

// Đổi trạng thái
await supabase
.from("withdraw_requests")
.update({

status:"rejected"

})
.eq("id", id);

res.json({

success:true

});

}catch(err){

res.json({

success:false,
error:err.message

});

}

});
app.get("/watch", (req, res) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.send("Login first");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const provider = req.query.provider;

    if (!["lootlabs", "linkvertise"].includes(provider)) {
      return res.send("Invalid provider");
    }

    // 🔥 LƯU SESSION
    watchSessions[decoded.id] = {
      startedAt: Date.now(),
      provider
    };

    // 🔥 LINK ADS (KHÔNG callback nữa)
    let link = "";

    if (provider === "lootlabs") {
      link = "https://loot-link.com/s?Io2URNwK";
    }

    if (provider === "linkvertise") {
      link = "https://direct-link.net/4248703/FxVrNlMWnooH";
    }

    return res.redirect(link);

  } catch (err) {
    res.send(err.message);
  }
});

app.post("/claim-mission", async (req, res) => {
try {
const token = req.cookies.token;

if (!token) {
    return res.json({
        success: false,
        message: "Please login first"
    });
}

const decoded = jwt.verify(token, process.env.JWT_SECRET);

// 🔒 CHẶN SPAM CLICK
if(claimLocks[decoded.id]){
    return res.json({
        success:false,
        message:"Too fast"
    });
}

// 🔒 LOCK USER
claimLocks[decoded.id] = true;

const { type } = req.body;

if (!["lootlabs","linkvertise"].includes(type)) {
    delete claimLocks[decoded.id];
    return res.json({
        success: false,
        message: "Invalid type"
    });
}

// 🔥 LẤY USER
const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", decoded.id)
    .single();

if (error) {
    delete claimLocks[decoded.id];
    return res.json({
        success: false,
        error: error.message
    });
}

const today = new Date().toISOString().slice(0,10);

// ✅ RESET NGÀY
if(user.last_mission_date !== today){
    await supabase
    .from("users")
    .update({
        lootlabs_progress: 0,
        linkvertise_progress: 0,
        last_mission_date: today
    })
    .eq("id", decoded.id);

    user.lootlabs_progress = 0;
    user.linkvertise_progress = 0;
}

// ❗ CHẶN HOÀN THÀNH RỒI
if(user[type + "_progress"] >= 2){
    delete claimLocks[decoded.id];
    return res.json({
        success:false,
        message:"Mission completed"
    });
}

// ❗ CHECK SESSION (ANTI FAKE WATCH)


// ✅ TĂNG PROGRESS (ANTI RACE)
const current = Number(user[type + "_progress"] || 0);

if(current >= 2){
    delete claimLocks[decoded.id];
    return res.json({ success:false });
}

const newProgress = current + 1;
const newSpin = Number(user.spin_chances || 0) + 1;

// ✅ UPDATE DB
await supabase
.from("users")
.update({
    [type + "_progress"]: newProgress,
    spin_chances: newSpin
})
.eq("id", decoded.id);

// 🔓 MỞ LOCK SAU 2s
setTimeout(() => {
    delete claimLocks[decoded.id];
}, 2000);

return res.json({
    success:true,
    spin_chances: newSpin,
    lootlabs_progress:
        type === "lootlabs" ? newProgress : user.lootlabs_progress,
    linkvertise_progress:
        type === "linkvertise" ? newProgress : user.linkvertise_progress
});

} catch (err) {
console.log("CLAIM ERROR:", err);

return res.json({
    success: false,
    message: "Server error"
});
}
});
app.post("/claim-daily", async (req, res) => {
try {

    const token = req.cookies.token;

    if (!token) {
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
    const { data:user, error } = await supabase
        .from("users")
        .select("id, spin_chances, last_claim_date")
        .eq("id", decoded.id)
        .single();

    if(error){
        return res.json({
            success:false,
            error:error.message
        });
    }

    const today = new Date().toISOString().slice(0,10);

    // ❌ đã claim hôm nay
    if(user.last_claim_date === today){
        return res.json({
            success:false,
            message:"Already claimed today"
        });
    }

    // ✅ update
    const newSpin = Number(user.spin_chances || 0) + 1;

    await supabase
        .from("users")
        .update({
            spin_chances: newSpin,
            last_claim_date: today
        })
        .eq("id", decoded.id);

    return res.json({
        success:true,
        spin_chances: newSpin
    });

} catch (err) {
    res.json({
        success:false,
        error:err.message
    });
}
});
// =============================
// WINNERS LIST
// =============================
app.get("/winners", async (req,res)=>{

try{

// lấy lịch sử spin
const { data, error } = await supabase
.from("spin_history")
.select("*")
.order("created_at",{ascending:false})
.limit(30);

if(error){
return res.json({
success:false,
error:error.message
});
}

// lấy danh sách user
const userIds = data.map(i=>i.user_id);

const { data: users } = await supabase
.from("users")
.select("id, username")
.in("id", userIds);

// map username
const winners = data
.filter(i => i.amount > 0 || i.label) // giữ item
.map(i => {

const user = users.find(u=>u.id === i.user_id);

return {
  username: user?.username || "Unknown",
  reward: i.label || `${i.amount} Tokens`,
  amount: i.amount
};

});

res.json({
success:true,
winners
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
