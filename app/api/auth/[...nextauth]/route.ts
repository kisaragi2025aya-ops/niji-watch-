// app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/youtube.readonly",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    // 引数すべてに : any を追加して厳格なチェックを回避
    async jwt({ token, account }: { token: any; account: any }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    // ここが修正ポイント：session と token にも型を指定
    async session({ session, token }: { session: any; token: any }) {
      session.accessToken = token.accessToken;
      if (session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };