import { AuthUserType } from '../../database/enums/auth-user-type.enum';

// Who performed an action, for tracker fields on audit rows.
export interface Actor {
  id: number;
  type: AuthUserType;
  name: string;
}
