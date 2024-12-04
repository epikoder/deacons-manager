import Input from "../../../../components/Input";

export default function () {
    return <div className="flex flex-col gap-4" >
        <Input type="password" name="password" autoComplete="current-password" placeholder="current password" />
        <Input type="password" name="new_password" autoComplete="new-password" placeholder="new password"/>
        <Input type="password" name="confirm_password" autoComplete="new-password" placeholder="confirm password"/>
    </div>
}