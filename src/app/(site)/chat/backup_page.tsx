import Chat from "@/components/Chat";

export default function ChatPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom right, #f8fafc, #e0f2fe)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: "120px", // ✅ clears navbar overlap
        paddingBottom: "60px", // ✅ ensures chat footer visible
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1000px",
          background: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
          padding: "20px",
          minHeight: "75vh",
        }}
      >
        <Chat />
      </div>
    </main>
  );
}
