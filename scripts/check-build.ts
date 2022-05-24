import execa from "execa";
import simpleGit from "simple-git/promise";
import { test } from "./test";

const git = simpleGit();

async function hasUncommittedChanges() {
  const status = await git.status();

  return (
    status.not_added.length > 0 ||
    status.created.length > 0 ||
    status.deleted.length > 0 ||
    status.modified.length > 0 ||
    status.renamed.length > 0 ||
    status.staged.length > 0
  );
}

async function gitAdd() {
  await git.add(".");
}

export default async function main() {
  test();
  await execa("npm", ["run", "build"]);

  if (await hasUncommittedChanges()) {
    await gitAdd();
    throw new Error("Commit your changes!");
  }
}
