import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../storage/token_store.dart';
import 'api_exception.dart';

final tokenStoreProvider = Provider<TokenStore>((_) => TokenStore());

/// Holds what to do when the server says the token is no longer good (expired, password changed).
class UnauthorizedHandler {
  void Function()? onUnauthorized;
}

final unauthorizedHandlerProvider = Provider<UnauthorizedHandler>((_) => UnauthorizedHandler());

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient(ref));

/// One place that talks to the server. Every path is relative to `/v1/api/seller`.
class ApiClient {
  ApiClient(this._ref)
      : _dio = Dio(BaseOptions(
          baseUrl: AppConfig.sellerApi,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 30),
          headers: {'Accept': 'application/json'},
        )) {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _ref.read(tokenStoreProvider).read();
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        handler.next(options);
      },
      onError: (error, handler) {
        // A 401 on login or on "change password" just means a wrong password; anywhere else the session ended.
        final path = error.requestOptions.path;
        final wrongPassword = path.startsWith('/auth/') || path == '/profile/password';
        if (error.response?.statusCode == 401 && !wrongPassword) {
          _ref.read(unauthorizedHandlerProvider).onUnauthorized?.call();
        }
        handler.next(error);
      },
    ));
  }

  final Ref _ref;
  final Dio _dio;

  /// A read is tried again twice (after 1 and 2 seconds) when the network drops or is slow.
  /// Writes are never repeated: the server may already have done them.
  Future<T> get<T>(String path, {Map<String, dynamic>? query}) async {
    for (var attempt = 0;; attempt++) {
      try {
        return await _run<T>(() => _dio.get(path, queryParameters: query));
      } on ApiException catch (e) {
        if (!e.isNetwork || attempt >= 2) rethrow;
        await Future<void>.delayed(Duration(seconds: attempt + 1));
      }
    }
  }
  Future<T> post<T>(String path, {Object? body}) => _run(() => _dio.post(path, data: body));
  Future<T> patch<T>(String path, {Object? body}) => _run(() => _dio.patch(path, data: body));
  Future<T> put<T>(String path, {Object? body}) => _run(() => _dio.put(path, data: body));

  Future<T> _run<T>(Future<Response<dynamic>> Function() call) async {
    try {
      final res = await call();
      return res.data as T;
    } catch (e) {
      throw ApiException.from(e);
    }
  }
}
