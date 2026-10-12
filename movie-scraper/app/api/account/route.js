import {currentUser,checkOrigin,passwordVerify,sessionCookie,authThrottle} from "../../../lib/auth.js";
import {readInput} from "../../../lib/vercel-api.js";
import {sql} from "../../../lib/db.js";
import {secureReply} from "../../../lib/api-auth.js";
export const runtime="nodejs";
export async function DELETE(req){
  if(!checkOrigin(req))return secureReply({error:"Forbidden"},403);
  try{
    const user=await currentUser(req);
    if(!user)return secureReply({error:"ابتدا وارد حساب شوید."},401);
    const attempt=await authThrottle(req,user.email,"delete");
    if(!attempt.allowed)return secureReply({error:"درخواست‌های زیادی ثبت شده است."},429);
    const input=await readInput(req);
    const rows=await sql("SELECT password_hash FROM cs_users WHERE id=? LIMIT 1",[user.id]);
    if(!rows.length||!(await passwordVerify(input.password,rows[0].password_hash)))
      return secureReply({error:"رمز عبور نادرست است."},401);
    // FK CASCADE clears sessions, tokens and private history.
    await sql("DELETE FROM cs_users WHERE id=?",[user.id]);
    return secureReply({ok:true},200,{"Set-Cookie":sessionCookie("",0)});
  }catch{return secureReply({error:"حذف حساب انجام نشد."},503);}
}
