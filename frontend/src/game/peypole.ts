type FakeDB =
{
  email: string;
  password: string;
};

const FakePPDB: FakeDB[] =
[
  { email: "sherpa@42.fr", password: "admin" },
  { email: "lc@42.fr", password: "admin" },
  { email: "a", password: "a" },
];

export function fakePay(email: string, password: string): boolean
{
  const user = FakePPDB.find(u => u.email === email && u.password === password);
  if (!user)
  {
    alert("Wrong password or email.\nCannot connect to PeyPole.");
    return (false);
  }
  return (true);
}
