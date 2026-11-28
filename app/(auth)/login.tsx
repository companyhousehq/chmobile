import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useSession } from "@/auth/SessionProvider";
import { login } from "@/lib/api/auth";
import { problemMessage } from "@/lib/problems";
import { useAction } from "@/lib/useAction";
import { isEmail } from "@/lib/validation";
import { strings } from "@/strings";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { IndependenceNotice } from "@/ui/IndependenceNotice";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

/** Sign-in (spec 0012 M1). The password is cleared from state as soon as it is sent. */
export default function Login() {
  const router = useRouter();
  const { signIn, sessionEnded } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [local, setLocal] = useState<{ email?: string; password?: string }>({});
  const action = useAction(login, "login");

  const submit = async () => {
    const errs: { email?: string; password?: string } = {};
    if (!isEmail(email.trim())) errs.email = "Enter a valid email address, like name@company.ng.";
    if (!password) errs.password = "Enter your password.";
    setLocal(errs);
    if (errs.email || errs.password) return;
    const sent = password;
    setPassword("");
    const res = await action.run(email.trim(), sent);
    if (res) await signIn(res.token, res.requirements);
    // The router moves on by itself: the session gate picks the group.
  };

  return (
    <Screen>
      <View style={{ gap: space[2] }}>
        <Text variant="title1" bold accessibilityRole="header">
          {strings.auth.signInTitle}
        </Text>
        <Text tone="text2">{strings.auth.signInIntro}</Text>
      </View>
      {sessionEnded ? (
        <Notice tone="info">
          {problemMessage({ type: "/problems/unauthenticated", status: 401 })}
        </Notice>
      ) : null}
      {action.error ? <Notice tone="danger">{action.error}</Notice> : null}
      <TextField
        label={strings.auth.email}
        value={email}
        onChangeText={setEmail}
        error={local.email ?? action.fields.email}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="next"
      />
      <TextField
        label={strings.auth.password}
        value={password}
        onChangeText={setPassword}
        error={local.password ?? action.fields.password}
        password
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <Button
        label={action.pending ? strings.auth.signingIn : strings.auth.signInButton}
        busy={action.pending}
        onPress={() => void submit()}
      />
      <Button
        label={strings.auth.forgotLink}
        variant="link"
        onPress={() => router.push("/forgot-password")}
      />
      <Button
        label={strings.auth.createAccountLink}
        variant="secondary"
        onPress={() => router.push("/signup")}
      />
      <IndependenceNotice />
    </Screen>
  );
}
