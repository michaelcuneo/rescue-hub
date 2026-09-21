import { Resource } from 'sst';
import {
	AdminCreateUserCommand,
	AdminDeleteUserCommand,
	AdminDisableUserCommand,
	AdminEnableUserCommand,
	AdminResetUserPasswordCommand,
	CognitoIdentityProviderClient,
	ListUsersCommand
} from '@aws-sdk/client-cognito-identity-provider';

export type RescueHubIdentity = {
	username: string;
	email: string;
	name: string;
	enabled: boolean;
	status: string;
	createdAt?: string;
	updatedAt?: string;
};

const client = new CognitoIdentityProviderClient({});

function attributesToRecord(
	attributes: Array<{ Name?: string; Value?: string }> | undefined
): Record<string, string> {
	return Object.fromEntries(
		(attributes ?? [])
			.filter((attribute) => attribute.Name && attribute.Value)
			.map((attribute) => [attribute.Name as string, attribute.Value as string])
	);
}

export async function listIdentities(): Promise<RescueHubIdentity[]> {
	const response = await client.send(
		new ListUsersCommand({
			UserPoolId: Resource.RescueHubUsers.id,
			Limit: 60
		})
	);

	return (response.Users ?? []).map((user) => {
		const attributes = attributesToRecord(user.Attributes);
		return {
			username: user.Username ?? '',
			email: attributes.email ?? '',
			name: attributes.name ?? '',
			enabled: user.Enabled ?? false,
			status: user.UserStatus ?? 'UNKNOWN',
			createdAt: user.UserCreateDate?.toISOString(),
			updatedAt: user.UserLastModifiedDate?.toISOString()
		};
	});
}

export async function inviteIdentity(input: {
	email: string;
	name: string;
}): Promise<void> {
	await client.send(
		new AdminCreateUserCommand({
			UserPoolId: Resource.RescueHubUsers.id,
			Username: input.email.toLowerCase(),
			UserAttributes: [
				{ Name: 'email', Value: input.email.toLowerCase() },
				{ Name: 'email_verified', Value: 'true' },
				{ Name: 'name', Value: input.name.trim() }
			],
			DesiredDeliveryMediums: ['EMAIL']
		})
	);
}

export async function setIdentityEnabled(username: string, enabled: boolean): Promise<void> {
	const Command = enabled ? AdminEnableUserCommand : AdminDisableUserCommand;
	await client.send(
		new Command({
			UserPoolId: Resource.RescueHubUsers.id,
			Username: username
		})
	);
}

export async function resetIdentityPassword(username: string): Promise<void> {
	await client.send(
		new AdminResetUserPasswordCommand({
			UserPoolId: Resource.RescueHubUsers.id,
			Username: username
		})
	);
}

export async function deleteIdentity(username: string): Promise<void> {
	await client.send(
		new AdminDeleteUserCommand({
			UserPoolId: Resource.RescueHubUsers.id,
			Username: username
		})
	);
}
