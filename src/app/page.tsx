// Force dynamic rendering since this page uses random content and is part of a database app
export const dynamic = "force-dynamic";

const welcomeMessages = [
  {
    title: "@n7olkachev/db-ui",
    tips: [],
  },
];

export default function Home() {
  const message =
    welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

  return (
    <div className="flex w-full h-full items-center justify-center">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">{message.title}</h2>
        </div>
        <div className="text-sm text-muted-foreground">
          {message.tips.map((tip, index) => (
            <p key={index}>{tip}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
