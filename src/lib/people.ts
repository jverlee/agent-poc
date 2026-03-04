export interface Person {
  name: string;
  role: string;
  avatar: string;
  appName: string;
  machineId: string;
}

export const people: Person[] = [
  {
    name: "Sam",
    role: "CX Specialist",
    avatar: "/avatars/sam.jpg",
    appName: "agent-a",
    machineId: "185924c433dd78",
  },
  {
    name: "Kelly",
    role: "Social Media Creator",
    avatar: "/avatars/kelly.jpg",
    appName: "agent-b",
    machineId: "17810e42f4e728",
  },
  {
    name: "Greg",
    role: "Analyst",
    avatar: "/avatars/greg.jpg",
    appName: "agent-c",
    machineId: "78171d2f2d7798",
  },
];

export function findPerson(appName: string, machineId: string): Person | undefined {
  return people.find((p) => p.appName === appName && p.machineId === machineId);
}
