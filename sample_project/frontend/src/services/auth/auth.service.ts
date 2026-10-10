import axios from 'axios';
import Cookies from 'js-cookie';

import type { IBaseHttpResponse } from '@/base/base.model';
import { httpService } from '@/base/http-service';
import { API_ENDPOINT } from '@/configs/constant.config';

import type {
  ILoginInput,
  ILoginResult,
  IUserInfo,
} from './auth.model';

class AuthService {
  async register(input: any) {
    const response = await axios.post<IBaseHttpResponse<any>>(
      `${API_ENDPOINT}/api/auth/register`,
      input,
    );
    return response.data;
  }

  async login(input: ILoginInput) {
    const response = await axios.post<IBaseHttpResponse<ILoginResult>>(
      `${API_ENDPOINT}/api/auth/login`,
      input,
    );

    const data = response?.data?.data || response?.data?.result;
    const expires = (data.expireInSeconds || 86400) / (3600 * 24);
    const cookieOptions: any = {
      expires,
      secure: false,
      sameSite: 'lax',
      path: '/',
    };

    Cookies.set('accessToken', data.accessToken, cookieOptions);

    return this.getUserInfo();
  }

  async getUserInfo() {
    const accessToken = Cookies.get('accessToken');
    if (!accessToken) {
      throw new Error('Access token is required');
    }

    const response = await httpService.request<IBaseHttpResponse<IUserInfo>>({
      url: '/api/auth/me',
      method: 'GET',
    });
    return response.data || response.result;
  }

  async refreshToken() {
    try {
      const accessToken = Cookies.get('accessToken');

      if (!accessToken) {
        return false;
      }

      const response = await axios.post<IBaseHttpResponse<{ accessToken: string; expireInSeconds: number }>>(
        `${API_ENDPOINT}/api/auth/refresh-token`,
        null,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const data = response.data?.data;

      if (!data?.accessToken) {
        return false;
      }

      const expires = (data.expireInSeconds || 86400) / (3600 * 24);
      const cookieOptions: any = {
        expires,
        secure: false,
        sameSite: 'lax',
        path: '/',
      };

      Cookies.set('accessToken', data.accessToken, cookieOptions);

      return true;
    } catch (error) {
      Cookies.remove('accessToken');
      window.location.href = '/auth/login';
      return false;
    }
  }

  async logout() {
    try {
      await httpService.request<IBaseHttpResponse<null>>({
        url: '/api/auth/logout',
        method: 'POST',
      });
    } catch (error) {
      // Ignore errors — we're logging out anyway
    } finally {
      Cookies.remove('accessToken');
      window.location.href = '/auth/login';
    }
  }
}

const authService = new AuthService();

export default authService;
