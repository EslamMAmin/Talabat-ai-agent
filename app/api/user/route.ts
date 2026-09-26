import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
  const userInfo = os.userInfo();
  const userName = userInfo.username || "Eslam Hafez";

  return NextResponse.json({ name: userName });
}